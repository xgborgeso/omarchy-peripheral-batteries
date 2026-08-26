# Peripherals Battery

Wireless mice, keyboards, headsets and controllers in the Omarchy Quattro bar, grouped by brand.

Plugins share the long-running Omarchy shell process. This plugin does not start a second Quickshell. It reads `/sys` through a Python 3 helper in the plugin folder and never opens `/dev/hidraw`.

## Install

Python 3 (stdlib only) ships with Omarchy. No extra packages and no compile step.

```sh
omarchy plugin add /home/gabriel/Work/omarchy-peripherals-battery --enable
```

`--enable` places the chip on the right of the bar.

Optional: some gaming headsets do not publish battery through the kernel. Install [headsetcontrol](https://github.com/Sapd/HeadsetControl) with `omarchy pkg add headsetcontrol`, then unplug and replug the dongle so its udev rules apply. The helper uses it when it is on `PATH`. Do not vendor the binary.

## Usage

Click the bar icon to open or close the details panel. Press Escape to close it. Middle click or `r` refreshes. Tab moves to the next stock panel.

The icon hides when nothing wireless is present (`hideWhenDisconnected`). Missing name or brand is placeholdered (`Mouse 1`, `Headset 2`) rather than erroring the widget.

## Configure

```sh
omarchy bar move io.github.gabriel.peripherals-battery --section right
omarchy bar set io.github.gabriel.peripherals-battery hideWhenDisconnected false --json
```

| Key | Default | Meaning |
|---|---|---|
| `hideWhenDisconnected` | true | Leave the bar when nothing is present |
| `refreshIntervalSec` | 30 | Poll interval |
| `lowBatteryPercent` | 20 | Warning / urgent colour |
| `criticalBatteryPercent` | 10 | Critical notification |
| `notifyOnLow` | true | Desktop notification |
| `notifyRepeatMinutes` | 0 | Re-notify while still low (0 = once) |

## Validate

```sh
PLUGIN_ID="io.github.gabriel.peripherals-battery"
PLUGIN_DIR="$HOME/.config/omarchy/plugins/$PLUGIN_ID"
omarchy plugin validate "$PLUGIN_DIR"
python3 "$PLUGIN_DIR/tests/helper.test.py"
node "$PLUGIN_DIR/tests/model.test.js"
```

`tests/` is copied with the plugin. `qmllint -I "$OMARCHY_PATH/shell" BarWidget.qml Panel.qml` is optional; on this system it is `/usr/lib/qt6/bin/qmllint`.

## Remove

```sh
omarchy plugin remove io.github.gabriel.peripherals-battery
```

## License

MIT. Not affiliated with Logitech or any peripheral vendor.
