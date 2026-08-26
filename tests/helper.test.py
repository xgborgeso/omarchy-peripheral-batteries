#!/usr/bin/env python3
import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "helper" / "status.py"
FIXTURES = ROOT / "tests" / "fixtures"

spec = importlib.util.spec_from_file_location("peripherals_status", HELPER)
helper = importlib.util.module_from_spec(spec)
sys.modules["peripherals_status"] = helper
assert spec.loader is not None
spec.loader.exec_module(helper)

LEVEL_UNKNOWN = helper.LEVEL_UNKNOWN
ITE_VID = helper.ITE_VID


def pack(sys_name, model, mfr, level):
    return helper.Pack(
        name=sys_name if not model else model,
        manufacturer=mfr,
        model=model,
        serial="",
        level=level,
        remaining_sec=LEVEL_UNKNOWN,
        status="discharging",
        charging=False,
        scope="Device",
        type_name="Battery",
        sys_name=sys_name,
    )


def hid(name, vid, pid, bus, driver):
    return helper.Hid(name=name, uniq="", vid=vid, pid=pid, bus=bus, driver=driver)


def stub(name, kind, level):
    return helper.Device(
        id=name,
        name=name,
        brand="Logitech",
        kind=kind,
        transport="lightspeed",
        level=level,
        remaining_sec=-1,
        status="discharging",
        charging=False,
        available=level >= 0,
    )


class HelperTests(unittest.TestCase):
    def test_parse_logitech_hid_id(self):
        self.assertEqual(helper.parse_hid_id("0003:0000046D:0000C547"), (0x0003, 0x046D, 0xC547))

    def test_this_machine_lists_mouse_and_headset(self):
        devices = helper.collect_from(FIXTURES / "this-machine")
        names = [d.name for d in devices]
        self.assertTrue(any("PRO X" in n and "LIGHTSPEED" not in n for n in names), names)
        self.assertTrue(any("LIGHTSPEED" in n for n in names), names)
        self.assertFalse(any("HyperX" in n for n in names), names)
        self.assertFalse(any("USB Receiver" in n for n in names), names)
        mouse = next(d for d in devices if "PRO X" in d.name and "LIGHTSPEED" not in d.name)
        headset = next(d for d in devices if "LIGHTSPEED" in d.name)
        self.assertEqual(mouse.level, 77)
        self.assertFalse(mouse.charging)
        self.assertEqual(mouse.kind, "mouse")
        self.assertEqual(headset.level, -1)
        self.assertFalse(headset.available)
        self.assertEqual(headset.kind, "headset")
        self.assertEqual(mouse.brand, "Logitech")
        self.assertEqual(headset.brand, "Logitech")

    def test_headsetcontrol_json_fills_headset_not_mouse(self):
        devices = [
            stub("Logitech PRO X", "mouse", 75),
            stub("Logitech PRO X 2 LIGHTSPEED", "headset", -1),
        ]
        parsed = {
            "devices": [
                {
                    "product": "Logitech G PRO X 2 LIGHTSPEED",
                    "battery": {"level": 67, "status": "BATTERY_AVAILABLE"},
                }
            ]
        }
        helper.apply_headsetcontrol_json(devices, parsed)
        self.assertEqual(devices[0].level, 75)
        self.assertEqual(devices[1].level, 67)
        self.assertTrue(devices[1].available)

    def test_laptop_pack_is_ignored(self):
        devices = helper.collect_from(FIXTURES / "laptop")
        self.assertEqual(devices, [])

    def test_empty_sysfs_is_ok(self):
        devices = helper.collect_from(FIXTURES / "empty")
        self.assertEqual(devices, [])

    def test_unnamed_device_pack_still_lists(self):
        devices = helper.merge([pack("hidpp_battery_0", "", "", 42)], [])
        self.assertEqual(len(devices), 1)
        self.assertEqual(devices[0].level, 42)
        self.assertEqual(devices[0].brand, "")
        self.assertEqual(devices[0].kind, "unknown")
        self.assertEqual(devices[0].name, "")
        self.assertTrue(devices[0].available)

    def test_two_unnamed_packs_still_list(self):
        devices = helper.merge(
            [pack("hidpp_battery_0", "", "", 10), pack("hidpp_battery_1", "", "", 20)],
            [],
        )
        self.assertEqual(len(devices), 2)
        self.assertTrue(all(d.name == "" and d.brand == "" for d in devices))

    def test_bluetooth_mouse_unknown_vid(self):
        devices = helper.merge([], [hid("Wireless Mouse", 0x1234, 0x0001, 0x0005, "hid-generic")])
        self.assertEqual(len(devices), 1)
        self.assertEqual(devices[0].kind, "mouse")
        self.assertEqual(devices[0].brand, "")
        self.assertEqual(devices[0].name, "Wireless Mouse")
        self.assertEqual(devices[0].transport, "bluetooth")
        self.assertEqual(devices[0].level, LEVEL_UNKNOWN)
        self.assertFalse(devices[0].available)

    def test_wired_usb_keyboard_is_ignored(self):
        devices = helper.merge([], [hid("Generic Keyboard", 0x04D9, 0x0001, 0x0003, "hid-generic")])
        self.assertEqual(devices, [])

    def test_razer_pack_uses_manufacturer(self):
        devices = helper.merge([pack("hid-1", "DeathAdder V3 Pro", "Razer", 80)], [])
        self.assertEqual(len(devices), 1)
        self.assertEqual(devices[0].brand, "Razer")
        self.assertEqual(devices[0].kind, "unknown")
        self.assertEqual(devices[0].level, 80)
        self.assertEqual(devices[0].name, "DeathAdder V3 Pro")

    def test_sony_dualsense_bluetooth(self):
        devices = helper.merge(
            [],
            [
                hid(
                    "Sony Interactive Entertainment DualSense Wireless Controller",
                    0x054C,
                    0x0CE6,
                    0x0005,
                    "sony",
                )
            ],
        )
        self.assertEqual(len(devices), 1)
        self.assertEqual(devices[0].brand, "Sony")
        self.assertEqual(devices[0].kind, "controller")
        self.assertEqual(devices[0].transport, "bluetooth")

    def test_logitech_kind_heuristics_do_not_apply_to_other_vids(self):
        devices = helper.merge([], [hid("Pro X Wireless", 0x1234, 0x0002, 0x0003, "hid-generic")])
        self.assertEqual(len(devices), 1)
        self.assertEqual(devices[0].kind, "unknown")
        self.assertEqual(devices[0].brand, "")
        self.assertEqual(devices[0].name, "Pro X Wireless")

    def test_sibling_survives_unrelated_hid(self):
        devices = helper.merge(
            [pack("ps-mouse", "Wireless Mouse", "Acme", 12)],
            [hid("ITE Device", ITE_VID, 0x0001, 0x0003, "hid-generic")],
        )
        self.assertEqual(len(devices), 1)
        self.assertEqual(devices[0].level, 12)
        self.assertEqual(devices[0].brand, "Acme")
        self.assertEqual(devices[0].kind, "mouse")

    def test_headsetcontrol_does_not_fill_unrelated_headset(self):
        devices = [
            stub("Logitech PRO X 2 LIGHTSPEED", "headset", -1),
            helper.Device(
                id="steel",
                name="SteelSeries Arctis Nova",
                brand="SteelSeries",
                kind="headset",
                transport="usb",
                level=LEVEL_UNKNOWN,
                remaining_sec=LEVEL_UNKNOWN,
                status="unknown",
                charging=False,
                available=False,
            ),
        ]
        parsed = {
            "devices": [
                {
                    "product": "Logitech G PRO X 2 LIGHTSPEED",
                    "battery": {"level": 67, "status": "BATTERY_AVAILABLE"},
                }
            ]
        }
        helper.apply_headsetcontrol_json(devices, parsed)
        self.assertEqual(devices[0].level, 67)
        self.assertEqual(devices[1].level, LEVEL_UNKNOWN)
        self.assertFalse(devices[1].available)

    def test_empty_hid_name_still_parses(self):
        parsed = helper.parse_uevent(
            "HID_ID=0003:00001532:00000001\nHID_NAME=\nDRIVER=hid-generic\n"
        )
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.vid, 0x1532)
        self.assertEqual(parsed.name, "")

    def test_cli_json_on_fixture(self):
        import os
        import subprocess

        env = os.environ.copy()
        env["PERIPHERALS_SYSFS"] = str(FIXTURES / "this-machine")
        out = subprocess.check_output(["python3", str(HELPER)], env=env, text=True)
        payload = json.loads(out)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["schema_version"], 1)
        names = [d["name"] for d in payload["devices"]]
        self.assertTrue(any("PRO X" in n for n in names), names)


if __name__ == "__main__":
    unittest.main()
