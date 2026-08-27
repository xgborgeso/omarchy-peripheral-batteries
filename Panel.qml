import QtQuick
import QtQuick.Controls
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui as Ui
import "Model.js" as Model

Ui.Panel {
  id: root
  moduleName: "io.github.xgborgeso.peripheral-batteries"
  ipcTarget: "io.github.xgborgeso.peripheral-batteries"
  manageIpc: false

  property int phraseIndex: 0

  readonly property bool hideWhenDisconnected: setting("hideWhenDisconnected", true) === true
  readonly property int lowBatteryPercent: {
    var n = parseInt(String(setting("lowBatteryPercent", 20)), 10)
    return isFinite(n) ? n : 20
  }
  readonly property color foreground: bar ? bar.foreground : Color.foreground
  readonly property color urgent: bar ? bar.urgent : Color.urgent
  readonly property color dim: Qt.darker(foreground, 1.55)
  // A bar icon follows `barForeground`, which tracks a transparent bar; panel
  // content follows `foreground`. They are not interchangeable.
  readonly property color barIconColor: !hasDevices
    ? Qt.darker(barForeground, 1.55)
    : (anyLow ? urgent : barForeground)
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family

  readonly property bool hasDevices: svc.hasDevices
  readonly property string lastError: String(svc.lastError || "")
  readonly property bool helperMissing: svc.helperMissing === true
  readonly property bool anyLow: Model.anyLow(svc.devices, lowBatteryPercent)
  readonly property var brandGroups: Model.brandGroups(svc.devices)

  readonly property var activePhrases: [
    "Dongle, engage",
    "Live long and charge",
    "It's a mouse, Jim",
    "Never tell me the charge",
    "Herding dongles",
    "Set phasers to charge",
    "Reverse the polarity",
    "Tractor beam the dongle",
    "Wireless, but make it so",
    "Counting milliamps"
  ]
  readonly property string heroPhraseText: activePhrases[phraseIndex % activePhrases.length]
  readonly property string heroMeta: !hasDevices
    ? (helperMissing ? "Helper missing" : (lastError !== "" ? "Cannot read devices" : "Not connected"))
    : heroPhraseText

  function pickHeroPhrase() {
    var n = activePhrases.length
    if (n <= 0) return
    var next = Math.floor(Math.random() * n)
    if (next === phraseIndex && n > 1)
      next = (phraseIndex + 1 + Math.floor(Math.random() * (n - 1))) % n
    phraseIndex = next
  }

  visible: !hideWhenDisconnected || hasDevices || lastError !== "" || helperMissing
  implicitWidth: visible ? button.implicitWidth : 0
  implicitHeight: visible ? button.implicitHeight : 0

  onOpenedChanged: if (opened) {
    pickHeroPhrase()
    if (panelFlick) panelFlick.contentY = 0
    svc.refresh()
    Qt.callLater(function () { keyCatcher.forceActiveFocus() })
  }

  Service {
    id: svc
    settings: root.settings
  }

  IpcHandler {
    target: root.ipcTarget
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
    tooltipText: "Open Peripheral Batteries"
    useActiveColor: false
    foreground: root.barIconColor
    onPressed: function (buttonCode) {
      if (buttonCode === Qt.MiddleButton) svc.refresh()
      else root.toggle()
    }
  }

  Ui.KeyboardPanel {
    id: panel
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(380))
    contentHeight: panel.fittedContentHeight(column.implicitHeight, Style.space(560))

    Ui.PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function (direction) { root.switchPanel(direction) }
      onTextKey: function (text) {
        if (String(text).toLowerCase() === "r") svc.refresh()
      }

      Flickable {
        id: panelFlick
        anchors.fill: parent
        contentWidth: width
        contentHeight: column.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        flickableDirection: Flickable.VerticalFlick
        interactive: contentHeight > height
        ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded }

        Column {
          id: column
          width: panelFlick.width
          spacing: Style.space(14)

          Ui.PanelHero {
            id: hero
            width: parent.width
            title: "Peripheral Batteries"
            meta: root.heroMeta
            foreground: root.foreground
            fontFamily: root.fontFamily
            iconOpacity: root.hasDevices ? 1.0 : 0.5
            iconComponent: Component {
              Text {
                textFormat: Text.PlainText
                text: "󰂂"
                color: root.hasDevices ? root.foreground : root.dim
                font.family: root.fontFamily
                font.pixelSize: Style.font.display
              }
            }
          }

          Text {
            textFormat: Text.PlainText
            visible: root.lastError !== ""
            width: parent.width
            text: root.lastError
            color: root.urgent
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            wrapMode: Text.WordWrap
          }

          Repeater {
            model: root.brandGroups
            Column {
              required property var modelData
              width: parent.width
              spacing: Style.space(6)
              visible: modelData.devices && modelData.devices.length > 0

              Ui.PanelSectionHeader {
                textFormat: Text.PlainText
                visible: modelData.headerShowsBrand === true && String(modelData.brand || "") !== ""
                text: String(modelData.brand || "").toUpperCase()
                foreground: root.foreground
                fontFamily: root.fontFamily
              }

              Repeater {
                model: modelData.devices
                BatteryRow {
                  required property var modelData
                  width: parent.width
                  device: modelData
                }
              }
            }
          }

          Text {
            textFormat: Text.PlainText
            visible: !root.hasDevices && root.lastError === ""
            width: parent.width
            text: "No wireless peripherals."
            color: root.dim
            font.family: root.fontFamily
            font.pixelSize: Style.font.body
            wrapMode: Text.WordWrap
            horizontalAlignment: Text.AlignHCenter
          }
        }
      }
    }
  }

  component BatteryRow: Item {
    id: batteryRow
    property var device: Model.defaultDevice()

    readonly property bool low: device.level !== Model.LEVEL_UNKNOWN
      && device.level <= root.lowBatteryPercent && !device.charging
    implicitHeight: rowInner.implicitHeight + Style.spacing.xl

    Row {
      id: rowInner
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      anchors.leftMargin: Style.space(6)
      anchors.rightMargin: Style.space(6)
      spacing: Style.space(8)

      Text {
        textFormat: Text.PlainText
        text: Model.kindGlyph(batteryRow.device.kind)
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.title
        width: Style.space(22)
        horizontalAlignment: Text.AlignHCenter
        anchors.verticalCenter: parent.verticalCenter
      }

      Text {
        textFormat: Text.PlainText
        text: Model.displayName(batteryRow.device)
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.body
        elide: Text.ElideRight
        width: Math.max(0, parent.width - Style.space(22) - Style.space(8) - Style.space(48) - Style.space(8))
        anchors.verticalCenter: parent.verticalCenter
      }

      Text {
        textFormat: Text.PlainText
        text: Model.levelText(batteryRow.device.level)
        color: batteryRow.low ? root.urgent : Qt.darker(root.foreground, 1.4)
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        font.bold: true
        width: Style.space(48)
        horizontalAlignment: Text.AlignRight
        anchors.verticalCenter: parent.verticalCenter
      }
    }
  }
}
