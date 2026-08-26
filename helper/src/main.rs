//! Read-only sysfs snapshot of wireless peripherals.
//! Never opens /dev/hidraw. JSON on stdout, always exit 0.

use serde::Serialize;
use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const SCHEMA_VERSION: u32 = 1;
const LEVEL_UNKNOWN: i32 = -1;

const LOGITECH_VID: u16 = 0x046d;
const ITE_VID: u16 = 0x048d;
const HYPERX_VID: u16 = 0x0951;

const LIGHTSPEED_PIDS: &[u16] = &[0xc547, 0xc53f, 0xc539, 0xc537];
const BOLT_PIDS: &[u16] = &[0xc548];
const UNIFYING_PIDS: &[u16] = &[0xc52b, 0xc532, 0xc537];

#[derive(Serialize, Clone, Debug)]
struct Device {
    id: String,
    name: String,
    brand: String,
    kind: String,
    transport: String,
    level: i32,
    remaining_sec: i32,
    status: String,
    charging: bool,
    available: bool,
}

#[derive(Serialize)]
struct Status {
    ok: bool,
    schema_version: u32,
    error: String,
    devices: Vec<Device>,
}

struct Hid {
    name: String,
    uniq: String,
    vid: u16,
    pid: u16,
    bus: u16,
    driver: String,
}

struct Pack {
    name: String,
    manufacturer: String,
    model: String,
    serial: String,
    level: i32,
    remaining_sec: i32,
    status: String,
    charging: bool,
    scope: String,
    type_name: String,
    sys_name: String,
}

fn main() {
    let status = match collect() {
        Ok(mut devices) => {
            enrich_headsetcontrol(&mut devices);
            Status {
                ok: true,
                schema_version: SCHEMA_VERSION,
                error: String::new(),
                devices,
            }
        }
        Err(err) => Status {
            ok: false,
            schema_version: SCHEMA_VERSION,
            error: err,
            devices: Vec::new(),
        },
    };
    match serde_json::to_string(&status) {
        Ok(json) => println!("{json}"),
        Err(err) => println!(
            "{{\"ok\":false,\"schema_version\":{SCHEMA_VERSION},\"error\":{},\"devices\":[]}}",
            serde_json::to_string(&err.to_string()).unwrap_or_else(|_| "\"encode failed\"".into())
        ),
    }
}

fn collect() -> Result<Vec<Device>, String> {
    collect_from(&sysfs_root())
}

fn collect_from(root: &Path) -> Result<Vec<Device>, String> {
    let packs = read_packs(&root.join("class/power_supply"));
    let hids = read_hids(&root.join("class/hidraw"));
    Ok(merge(packs, hids))
}

fn sysfs_root() -> PathBuf {
    env::var("PERIPHERALS_SYSFS")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/sys"))
}

fn read_file(path: &Path) -> String {
    fs::read_to_string(path)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn read_packs(dir: &Path) -> Vec<Pack> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut packs = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let sys_name = entry.file_name().to_string_lossy().to_string();
        let type_name = read_file(&path.join("type"));
        if !type_name.eq_ignore_ascii_case("Battery") {
            continue;
        }
        let scope = read_file(&path.join("scope"));
        let serial = read_file(&path.join("serial_number"));
        let model = read_file(&path.join("model_name"));
        let manufacturer = read_file(&path.join("manufacturer"));
        let status = read_file(&path.join("status"));
        let charging = status.eq_ignore_ascii_case("Charging")
            || status.eq_ignore_ascii_case("Full");
        let level = read_file(&path.join("capacity"))
            .parse::<i32>()
            .ok()
            .filter(|n| (0..=100).contains(n))
            .unwrap_or(LEVEL_UNKNOWN);
        packs.push(Pack {
            name: if model.is_empty() {
                sys_name.clone()
            } else {
                model.clone()
            },
            manufacturer,
            model,
            serial,
            level,
            remaining_sec: remaining_secs(&path, charging),
            status: status_token(&status),
            charging,
            scope,
            type_name,
            sys_name,
        });
    }
    packs
}

fn read_hids(dir: &Path) -> Vec<Hid> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut hids = Vec::new();
    for entry in entries.flatten() {
        let uevent = read_file(&entry.path().join("device/uevent"));
        if uevent.is_empty() {
            continue;
        }
        if let Some(hid) = parse_uevent(&uevent) {
            hids.push(hid);
        }
    }
    hids
}

fn parse_uevent(text: &str) -> Option<Hid> {
    let mut name = String::new();
    let mut uniq = String::new();
    let mut driver = String::new();
    let mut hid_id = String::new();
    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("HID_NAME=") {
            name = rest.trim().to_string();
        } else if let Some(rest) = line.strip_prefix("HID_UNIQ=") {
            uniq = rest.trim().to_string();
        } else if let Some(rest) = line.strip_prefix("DRIVER=") {
            driver = rest.trim().to_string();
        } else if let Some(rest) = line.strip_prefix("HID_ID=") {
            hid_id = rest.trim().to_string();
        }
    }
    if name.is_empty() {
        return None;
    }
    let (bus, vid, pid) = parse_hid_id(&hid_id)?;
    Some(Hid {
        name,
        uniq,
        vid,
        pid,
        bus,
        driver,
    })
}

/// HID_ID is BUS:VID:PID as 4/8/8 hex digits, e.g. 0003:0000046D:0000C547.
fn parse_hid_id(value: &str) -> Option<(u16, u16, u16)> {
    let mut parts = value.split(':');
    let bus = u16::from_str_radix(parts.next()?, 16).ok()?;
    let vid = u32::from_str_radix(parts.next()?, 16).ok()? as u16;
    let pid = u32::from_str_radix(parts.next()?, 16).ok()? as u16;
    Some((bus, vid, pid))
}

fn is_laptop_pack(pack: &Pack) -> bool {
    if pack.scope.eq_ignore_ascii_case("System") {
        return true;
    }
    let sys = pack.sys_name.to_ascii_lowercase();
    if pack.scope.eq_ignore_ascii_case("Device") {
        return false;
    }
    sys.starts_with("bat") || sys.starts_with("cmb") || sys.contains("macsmc")
}

fn is_receiver(hid: &Hid) -> bool {
    hid.driver == "logitech-djreceiver"
        || hid.name.eq_ignore_ascii_case("Logitech USB Receiver")
        || hid.name.to_ascii_lowercase().contains("unifying receiver")
}

fn is_internal(hid: &Hid) -> bool {
    hid.vid == ITE_VID || hid.name.to_ascii_lowercase().starts_with("ite ")
}

fn is_wired_ignored(hid: &Hid) -> bool {
    hid.vid == HYPERX_VID || hid.name.to_ascii_lowercase().contains("hyperx")
}

fn looks_wireless(hid: &Hid) -> bool {
    if hid.bus == 0x0005 {
        return true;
    }
    if hid.driver == "logitech-hidpp-device" {
        return true;
    }
    if hid.vid == LOGITECH_VID && !is_receiver(hid) {
        return true;
    }
    let n = hid.name.to_ascii_lowercase();
    n.contains("lightspeed")
        || n.contains("wireless")
        || n.contains("bluetooth")
        || n.contains("bolt")
        || n.contains("unifying")
}

fn kind_of(name: &str, hid: Option<&Hid>) -> String {
    let n = name.to_ascii_lowercase();
    if n.contains("headset") || n.contains("headphone") || n.contains("earbuds") {
        return "headset".into();
    }
    if n.contains("keyboard") || n.contains("keys") {
        return "keyboard".into();
    }
    if n.contains("controller") || n.contains("gamepad") {
        return "controller".into();
    }
    if n.contains("mouse") || n.contains("pro x") && !n.contains("lightspeed") {
        return "mouse".into();
    }
    if let Some(hid) = hid {
        if hid.driver == "logitech-hidpp-device" {
            return "mouse".into();
        }
        let hn = hid.name.to_ascii_lowercase();
        if hn.contains("lightspeed") && !hn.contains("mouse") {
            return "headset".into();
        }
    }
    "unknown".into()
}

fn transport_of(hid: Option<&Hid>, pack_name: &str) -> String {
    if let Some(hid) = hid {
        if hid.bus == 0x0005 {
            return "bluetooth".into();
        }
        if LIGHTSPEED_PIDS.contains(&hid.pid)
            || hid.name.to_ascii_lowercase().contains("lightspeed")
        {
            return "lightspeed".into();
        }
        if BOLT_PIDS.contains(&hid.pid) {
            return "bolt".into();
        }
        if UNIFYING_PIDS.contains(&hid.pid) {
            return "unifying".into();
        }
        if hid.driver == "logitech-hidpp-device" || hid.vid == LOGITECH_VID {
            return "lightspeed".into();
        }
        return "usb".into();
    }
    let n = pack_name.to_ascii_lowercase();
    if n.contains("lightspeed") {
        "lightspeed".into()
    } else {
        "unknown".into()
    }
}

fn uniq_ok(value: &str) -> bool {
    let t = value.trim();
    if t.is_empty() {
        return false;
    }
    !t.chars().all(|c| c == '0' || c == '-')
}

fn merge(packs: Vec<Pack>, hids: Vec<Hid>) -> Vec<Device> {
    let has_hidpp_child = hids.iter().any(|h| h.driver == "logitech-hidpp-device");
    let mut unique_hids: BTreeMap<(u16, u16, u16, String), Hid> = BTreeMap::new();
    for hid in hids {
        let key = (hid.bus, hid.vid, hid.pid, hid.name.clone());
        unique_hids.entry(key).or_insert(hid);
    }
    let hids: Vec<Hid> = unique_hids.into_values().collect();

    let mut devices: BTreeMap<String, Device> = BTreeMap::new();
    let mut claimed_serials: Vec<String> = Vec::new();

    for pack in &packs {
        if is_laptop_pack(pack) {
            continue;
        }
        let id = if uniq_ok(&pack.serial) {
            format!("pack:{}", pack.serial)
        } else {
            format!("pack:{}", pack.sys_name)
        };
        let hid = hids.iter().find(|h| {
            uniq_ok(&h.uniq) && uniq_ok(&pack.serial) && eq_serial(&h.uniq, &pack.serial)
        }).or_else(|| {
            hids.iter().find(|h| {
                !is_receiver(h)
                    && (h.name.eq_ignore_ascii_case(&pack.name)
                        || h.name.eq_ignore_ascii_case(&pack.model))
            })
        });
        if let Some(h) = hid {
            if uniq_ok(&h.uniq) {
                claimed_serials.push(h.uniq.clone());
            }
        }
        let name = hid.map(|h| h.name.clone()).unwrap_or_else(|| pack.name.clone());
        devices.insert(
            id.clone(),
            Device {
                id,
                brand: brand_of(hid, &pack.manufacturer, &name),
                kind: kind_of(&name, hid),
                transport: transport_of(hid, &name),
                name,
                level: pack.level,
                remaining_sec: pack.remaining_sec,
                status: pack.status.clone(),
                charging: pack.charging,
                available: pack.level != LEVEL_UNKNOWN,
            },
        );
    }

    for hid in &hids {
        if is_internal(hid) || is_wired_ignored(hid) {
            continue;
        }
        if is_receiver(hid) && has_hidpp_child {
            continue;
        }
        if !looks_wireless(hid) {
            continue;
        }
        if uniq_ok(&hid.uniq) && claimed_serials.iter().any(|s| eq_serial(s, &hid.uniq)) {
            continue;
        }
        let already = devices.values().any(|d| d.name.eq_ignore_ascii_case(&hid.name));
        if already {
            continue;
        }
        let id = if uniq_ok(&hid.uniq) {
            format!("hid:{}", hid.uniq)
        } else {
            format!("hid:{:04x}:{:04x}:{}", hid.vid, hid.pid, slug(&hid.name))
        };
        devices.insert(
            id.clone(),
            Device {
                id,
                name: hid.name.clone(),
                brand: brand_of(Some(hid), "", &hid.name),
                kind: kind_of(&hid.name, Some(hid)),
                transport: transport_of(Some(hid), &hid.name),
                level: LEVEL_UNKNOWN,
                remaining_sec: LEVEL_UNKNOWN,
                status: "unknown".into(),
                charging: false,
                available: false,
            },
        );
    }

    let mut out: Vec<Device> = devices.into_values().collect();
    out.sort_by(|a, b| {
        a.brand
            .cmp(&b.brand)
            .then(a.kind.cmp(&b.kind))
            .then(a.name.cmp(&b.name))
    });
    let _ = packs.iter().map(|p| &p.type_name).count();
    out
}

fn brand_of(hid: Option<&Hid>, manufacturer: &str, name: &str) -> String {
    let from_mfr = manufacturer.trim();
    if !from_mfr.is_empty() && !from_mfr.eq_ignore_ascii_case("unknown") {
        return title_brand(from_mfr);
    }
    if let Some(h) = hid {
        if h.vid == LOGITECH_VID {
            return "Logitech".into();
        }
        if h.vid == HYPERX_VID {
            return "HyperX".into();
        }
    }
    let lower = name.to_ascii_lowercase();
    if lower.contains("logitech") {
        return "Logitech".into();
    }
    if lower.contains("razer") {
        return "Razer".into();
    }
    if lower.contains("steelseries") {
        return "SteelSeries".into();
    }
    if lower.contains("sony") {
        return "Sony".into();
    }
    "Other".into()
}

fn status_token(raw: &str) -> String {
    let s = raw.trim().to_ascii_lowercase();
    if s == "charging" {
        "charging".into()
    } else if s == "full" {
        "full".into()
    } else if s == "discharging" {
        "discharging".into()
    } else if s.is_empty() {
        "unknown".into()
    } else {
        s
    }
}

fn parse_positive_i32(path: &Path) -> i32 {
    read_file(path)
        .parse::<i32>()
        .ok()
        .filter(|n| *n > 0)
        .unwrap_or(0)
}

fn parse_i64(path: &Path) -> Option<i64> {
    read_file(path).parse::<i64>().ok()
}

fn remaining_secs(path: &Path, charging: bool) -> i32 {
    let to_empty = parse_positive_i32(&path.join("time_to_empty_now"));
    let to_full = parse_positive_i32(&path.join("time_to_full_now"));
    if charging && to_full > 0 {
        return to_full;
    }
    if !charging && to_empty > 0 {
        return to_empty;
    }
    let charge = parse_i64(&path.join("charge_now")).filter(|n| *n > 0);
    let current = parse_i64(&path.join("current_now")).map(|n| n.abs()).filter(|n| *n > 0);
    if let (Some(ch), Some(cu)) = (charge, current) {
        return ((ch as f64 / cu as f64) * 3600.0).round() as i32;
    }
    let energy = parse_i64(&path.join("energy_now")).filter(|n| *n > 0);
    let power = parse_i64(&path.join("power_now")).map(|n| n.abs()).filter(|n| *n > 0);
    if let (Some(en), Some(pw)) = (energy, power) {
        return ((en as f64 / pw as f64) * 3600.0).round() as i32;
    }
    LEVEL_UNKNOWN
}

fn title_brand(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(c) => c.to_uppercase().collect::<String>() + &chars.as_str().to_ascii_lowercase(),
        None => "Other".into(),
    }
}

/// Optional: HeadsetControl talks the vendor HID the kernel does not export.
/// Missing binary or hidraw permission leaves the row as unknown.
fn enrich_headsetcontrol(devices: &mut [Device]) {
    let output = std::process::Command::new("headsetcontrol")
        .args(["-b", "-o", "json"])
        .output();
    let Ok(output) = output else {
        return;
    };
    if !output.status.success() {
        return;
    }
    let Ok(parsed) = serde_json::from_slice::<serde_json::Value>(&output.stdout) else {
        return;
    };
    let list = parsed
        .get("devices")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    for entry in list {
        let product = entry
            .get("product")
            .or_else(|| entry.get("device"))
            .or_else(|| entry.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if product.is_empty() {
            continue;
        }
        let battery = entry.get("battery").cloned().unwrap_or(entry.clone());
        let level = battery
            .get("level")
            .or_else(|| battery.get("percentage"))
            .and_then(|v| v.as_i64())
            .map(|n| n as i32)
            .filter(|n| (0..=100).contains(n));
        let Some(level) = level else {
            continue;
        };
        let charging = battery
            .get("status")
            .and_then(|v| v.as_str())
            .map(|s| s.to_ascii_lowercase().contains("charg"))
            .unwrap_or(false);
        for device in devices.iter_mut() {
            if device.kind != "headset" {
                continue;
            }
            let name = device.name.to_ascii_lowercase();
            if name.contains(&product) || product.contains(&name) || product.contains("pro x 2")
            {
                device.level = level;
                device.charging = charging;
                device.available = true;
            }
        }
    }
}

fn eq_serial(a: &str, b: &str) -> bool {
    a.eq_ignore_ascii_case(b)
}

fn slug(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_ascii_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_logitech_hid_id() {
        assert_eq!(
            parse_hid_id("0003:0000046D:0000C547"),
            Some((0x0003, 0x046d, 0xc547))
        );
    }

    fn fixture(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures").join(name)
    }

    #[test]
    fn this_machine_lists_mouse_and_headset() {
        let devices = collect_from(&fixture("this-machine")).unwrap();
        let names: Vec<_> = devices.iter().map(|d| d.name.as_str()).collect();
        assert!(names.iter().any(|n| n.contains("PRO X") && !n.contains("LIGHTSPEED")), "{names:?}");
        assert!(names.iter().any(|n| n.contains("LIGHTSPEED")), "{names:?}");
        assert!(!names.iter().any(|n| n.contains("HyperX")), "{names:?}");
        assert!(!names.iter().any(|n| n.contains("USB Receiver")), "{names:?}");
        let mouse = devices.iter().find(|d| d.name.contains("PRO X") && !d.name.contains("LIGHTSPEED")).unwrap();
        assert_eq!(mouse.level, 77);
        assert!(!mouse.charging);
        assert_eq!(mouse.kind, "mouse");
        let headset = devices.iter().find(|d| d.name.contains("LIGHTSPEED")).unwrap();
        assert_eq!(headset.level, -1);
        assert!(!headset.available);
        assert_eq!(headset.kind, "headset");
        assert_eq!(mouse.brand, "Logitech");
        assert_eq!(headset.brand, "Logitech");
    }

    #[test]
    fn laptop_pack_is_ignored() {
        let devices = collect_from(&fixture("laptop")).unwrap();
        assert!(devices.is_empty(), "{devices:?}");
    }

    #[test]
    fn empty_sysfs_is_ok() {
        let devices = collect_from(&fixture("empty")).unwrap();
        assert!(devices.is_empty());
    }
}
