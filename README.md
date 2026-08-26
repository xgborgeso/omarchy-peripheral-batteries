# Peripherals Battery

Wireless mice, keyboards, headsets and controllers in the Omarchy bar, grouped by brand.

This occupies the same job as `hl.peripheral_battery`. The panel is drawn in the Nothing Audio idiom (hero + labeled meters + charging pulse), and devices without a UPower pack still appear as `--`.

## Install (local)

```sh
cd helper && cargo build --release && cd ..
omarchy plugin add /home/gabriel/Work/omarchy-peripherals-battery --enable
```

`--enable` places the chip on the right of the bar. Rebuild the helper after changing Rust:

```sh
cargo build --release --manifest-path helper/Cargo.toml
omarchy restart shell
```

The plugin directory is a git clone. After `plugin add`, the live copy is `~/.config/omarchy/plugins/io.github.gabriel.peripherals-battery/`. Copy the helper binary there too, or build inside that clone.

## Usage

- Left click the chip: open the panel
- Middle click: refresh
- `r`: refresh
- Esc: close
- Tab: next stock panel

The icon hides when nothing wireless is present (`hideWhenDisconnected`).

## Settings

```sh
omarchy bar set io.github.gabriel.peripherals-battery hideWhenDisconnected false --json
omarchy bar set io.github.gabriel.peripherals-battery refreshIntervalSec 15 --json
```

| Key | Default | Meaning |
|---|---|---|
| `hideWhenDisconnected` | true | Leave the bar when nothing is present |
| `refreshIntervalSec` | 30 | Poll interval |
| `lowBatteryPercent` | 20 | Warning / urgent colour |
| `criticalBatteryPercent` | 10 | Critical notification |
| `notifyOnLow` | true | Desktop notification |
| `notifyRepeatMinutes` | 0 | Re-notify while still low (0 = once) |

Gaming headsets such as the PRO X 2 LIGHTSPEED do not publish battery through the kernel. Optional: install [headsetcontrol](https://github.com/Sapd/HeadsetControl) (`omarchy pkg add headsetcontrol`), then unplug and replug the dongle so its udev rules apply. The helper uses it when it is on `PATH`. Do not vendor the binary in this repo.

## What it does not do

- Button remap, DPI, SmartShift, RGB (OpenLogi / Solaar / Piper)
- Laptop battery (`omarchy.power`)
- Connect / forget (stock Bluetooth)
- Remaining runtime. Percent only; no guessed hours and no click-to-cycle readout.

## Remove

```sh
omarchy plugin remove io.github.gabriel.peripherals-battery
```

## License

MIT. Not affiliated with Logitech or any peripheral vendor.
