# Peripherals Battery

Wireless mice, keyboards, headsets and controllers in the Omarchy Quattro bar, grouped by brand.

This occupies the same job as `hl.peripheral_battery`. Devices without a kernel battery pack still appear as `--`. Missing name or brand is placeholdered (`Mouse 1`, `Headset 2`) rather than erroring the widget.

Plugins share the long-running Omarchy shell process. This one reads `/sys` through a local helper and never opens `/dev/hidraw`.

## Install

Build the helper, then add the plugin from this folder:

```sh
cargo build --release --manifest-path helper/Cargo.toml
omarchy plugin add /home/gabriel/Work/omarchy-peripherals-battery --enable
```

`--enable` places the chip on the right of the bar. After `plugin add`, the live copy is `~/.config/omarchy/plugins/io.github.gabriel.peripherals-battery/`. Rebuild the helper there too (or copy `helper/target/release/peripherals-status`) after Rust changes:

```sh
cargo build --release --manifest-path helper/Cargo.toml
omarchy restart shell
```

Optional: gaming headsets such as the PRO X 2 LIGHTSPEED do not publish battery through the kernel. Install [headsetcontrol](https://github.com/Sapd/HeadsetControl) (`omarchy pkg add headsetcontrol`), then unplug and replug the dongle so its udev rules apply. The helper uses it when it is on `PATH`. Do not vendor the binary in this repo.

## Usage

Click the bar icon to open or close the details panel. Escape closes it. Middle click or `r` refreshes. Tab moves to the next stock panel.

The icon hides when nothing wireless is present (`hideWhenDisconnected`).

## Configure

```sh
omarchy bar move io.github.gabriel.peripherals-battery --section right
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

## What it does not do

- Button remap, DPI, SmartShift, RGB (OpenLogi / Solaar / Piper)
- Laptop battery (`omarchy.power`)
- Connect / forget (stock Bluetooth)
- Remaining runtime. Percent only; no guessed hours.

## Remove

```sh
omarchy plugin remove io.github.gabriel.peripherals-battery
```

## License

MIT. Not affiliated with Logitech or any peripheral vendor.
