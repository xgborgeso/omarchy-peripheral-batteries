import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui as Ui
import "Model.js" as Model

Ui.BarWidget {
  id: root
  moduleName: "io.github.gabriel.peripherals-battery"

  readonly property bool hideWhenDisconnected: setting("hideWhenDisconnected", true) === true
  readonly property int lowBatteryPercent: {
    var n = parseInt(String(setting("lowBatteryPercent", 20)), 10)
    return isFinite(n) ? n : 20
  }
  readonly property color barForeground: bar ? bar.foreground : Color.foreground
  readonly property bool devicesPresent: svc.hasDevices
  readonly property bool anyLow: Model.anyLow(svc.devices, lowBatteryPercent)
  readonly property color barIconColor: !devicesPresent
    ? Qt.darker(barForeground, 1.55)
    : (anyLow ? (bar ? bar.urgent : Color.urgent) : barForeground)

  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false
  readonly property bool popoutSwitchClosing: panelLoader.item
    ? panelLoader.item.popoutSwitchClosing === true
    : false

  function open() {
    if (panelLoader.item) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  function toggle() {
    if (panelLoader.item) panelLoader.item.toggle()
  }

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
    if ("service" in target) target.service = svc
  }

  visible: !hideWhenDisconnected || svc.hasDevices || svc.lastError !== "" || svc.helperMissing
  implicitWidth: visible ? button.implicitWidth : 0
  implicitHeight: visible ? button.implicitHeight : 0

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()

  Service {
    id: svc
    settings: root.settings
  }

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  IpcHandler {
    target: "peripherals-battery"
    function open(): void { root.open() }
    function close(): void { root.close() }
    function toggle(): void { root.toggle() }
    function refresh(): string { svc.refresh(); return "ok" }
    function status(): string {
      if (!svc.hasDevices) return "disconnected"
      var parts = []
      for (var i = 0; i < svc.devices.length; i++) {
        var d = svc.devices[i]
        parts.push(d.name + " " + Model.levelText(d.level))
      }
      return parts.join(" · ")
    }
  }

  Ui.BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "󰂂"
    tooltipText: "Open Peripherals Battery"
    useActiveColor: false
    foreground: root.barIconColor
    onPressed: function (buttonCode) {
      if (buttonCode === Qt.MiddleButton) svc.refresh()
      else root.toggle()
    }
  }
}
