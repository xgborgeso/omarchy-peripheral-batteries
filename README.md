<h1 align="center">Peripheral Batteries</h1>

<p align="center">
  Battery percent for each wireless peripheral: mouse, keyboard, headset and controller, grouped by brand.
</p>

<p align="center">
  <img src="preview.png" alt="The Peripheral Batteries panel open in the Omarchy bar" width="420">
</p>

## What it shows

- **Presence and percent** for wireless mice, keyboards, headsets and controllers the kernel (or optional `headsetcontrol`) already reports.
- **Brand groups**, when the manufacturer or USB vendor id is known. LOGITECH here, nothing invented for a no-name dongle.
- **Placeholders** when the name or brand is missing: `Mouse 1`, `Headset 2`, `Device 1`. Missing identity never errors the widget. Missing percent is `--`.
- **Low-battery colour and a desktop notification**, using the same warning / critical thresholds you set on the bar.

## Deliberately absent

- **Remaining runtime.** The kernel almost never publishes discharge current for these packs, and marketing hours for a named SKU are not safe to assume for every user's hardware.
- **Button remap, DPI, SmartShift, RGB.** That is OpenLogi, Solaar, or Piper.
- **Laptop battery.** That is `omarchy.power`.
- **Connect / forget.** Stock Bluetooth.

## Requirements

- Omarchy 4 (Quattro). Python 3 is already on the system; the helper uses the standard library only.
- Optional: [headsetcontrol](https://github.com/Sapd/HeadsetControl) on `PATH` for gaming headsets the kernel does not expose (for example a PRO X 2 LIGHTSPEED). `omarchy pkg add headsetcontrol`, then unplug and replug the dongle so its udev rules apply. Do not vendor the binary.

## How it works

The plugin is a bar widget. `BarWidget.qml` is the chip; it loads `Panel.qml`. A nested `Service.qml` runs `helper/peripherals-status.py` on an interval. That script reads `/sys` only and never opens `/dev/hidraw`. JSON on stdout, always exit 0.

`omarchy plugin add` clones files. It does not compile anything, does not run a setup hook, and does not ask for sudo.

## Install

```bash
omarchy plugin add https://github.com/xgborgeso/omarchy-peripheral-batteries.git --enable
```

`--enable` places the chip on the right of the bar. The icon hides when nothing wireless is present (`hideWhenDisconnected`). To keep it visible:

```bash
omarchy bar set io.github.gabriel.peripheral-batteries hideWhenDisconnected false --json
```

## Remove

```bash
omarchy plugin remove io.github.gabriel.peripheral-batteries
```

## Keyboard

| Key | Action |
|-----|--------|
| left click | open or close the panel |
| middle click | refresh |
| `r` | refresh |
| `tab` | next stock panel |
| `esc` | close |

A new hero line is chosen each time the panel opens. It stays until you close.

## Settings

| Setting | Default | Notes |
|---------|---------|-------|
| Hide when disconnected | on | Leaves the bar rather than sitting empty. |
| Refresh interval | 30 s | Poll cadence. |
| Warning battery % | 20 | Urgent colour. |
| Critical battery % | 10 | Critical notification. |
| Notify on low | on | Desktop notification. |
| Re-notify every N minutes | 0 | `0` means once. |

```bash
omarchy bar move io.github.gabriel.peripheral-batteries --section right
omarchy bar set io.github.gabriel.peripheral-batteries refreshIntervalSec 15 --json
```

## Contributing

Bug reports and pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md)
covers the checks, what review will ask you to prove, and the house style.
[AGENTS.md](AGENTS.md) adds the traps coding agents hit in this tree.

## Tests

`Model.js` is parsing and formatting with no QML imports. The helper is Python 3 stdlib.

```bash
python3 tests/helper.test.py
node tests/model.test.js
omarchy plugin validate .
```

## Licence

MIT. [LICENSE](LICENSE). Not affiliated with Logitech or any peripheral vendor.
