import QtQuick
import QtQuick.Controls
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

Panel {
  id: root
  moduleName: "io.github.gabriel.peripherals-battery"
  ipcTarget: "peripherals-battery"
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
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property bool devicesPresent: svc.hasDevices
  readonly property bool anyLow: Model.anyLow(svc.devices, lowBatteryPercent)
  readonly property color barIconColor: !devicesPresent
    ? Qt.darker(barForeground, 1.55)
    : (anyLow ? (bar ? bar.urgent : Color.urgent) : barForeground)

  readonly property var activePhrases: [
    "Herding dongles",
    "Counting milliamps",
    "Watching the wireless",
    "Keeping charge in sight",
    "Polling the peripherals",
    "Minding the meters"
  ]
  readonly property string heroPhraseText: activePhrases[phraseIndex % activePhrases.length]
  readonly property string heroTitle: "Peripherals Battery"
  readonly property var brandGroups: Model.brandGroups(svc.devices)
  property string levelDisplay: "percent"

  function cycleLevelDisplay() {
    var next = Model.nextDisplayMode(root.levelDisplay, svc.devices)
    root.levelDisplay = next
    var updated = {}
    var src = root.settings || {}
    for (var key in src) updated[key] = src[key]
    updated.levelDisplay = next
    if (bar && bar.shell && typeof bar.shell.updateEntryInline === "function")
      bar.shell.updateEntryInline(moduleName, updated)
  }
  readonly property string heroMeta: !svc.hasDevices
    ? (svc.helperMissing ? "Helper not built" : (svc.lastError !== "" ? "Cannot read devices" : "Not connected"))
    : heroPhraseText

  visible: !hideWhenDisconnected || svc.hasDevices || svc.lastError !== "" || svc.helperMissing
  implicitWidth: visible ? button.implicitWidth : 0
  implicitHeight: visible ? button.implicitHeight : 0

  onOpenedChanged: if (opened) {
    if (panelFlick) panelFlick.contentY = 0
    svc.refresh()
    Qt.callLater(function () { keyCatcher.forceActiveFocus() })
  }

  onSettingsChanged: {
    var mode = String(setting("levelDisplay", "percent") || "percent")
    if (Model.displayModes(svc.devices).indexOf(mode) >= 0) root.levelDisplay = mode
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

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "󰂂"
    useActiveColor: false
    foreground: root.barIconColor
    onPressed: function (buttonCode) {
      if (buttonCode === Qt.MiddleButton) svc.refresh()
      else root.toggle()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(380))
    contentHeight: panel.fittedContentHeight(column.implicitHeight, Style.space(560))

    PanelKeyCatcher {
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

          PanelHero {
            id: hero
            width: parent.width
            title: root.heroTitle
            meta: root.heroMeta
            foreground: root.foreground
            fontFamily: root.fontFamily
            iconOpacity: svc.hasDevices ? 1.0 : 0.5
            iconComponent: Component {
              Text {
                text: "󰂂"
                color: svc.hasDevices ? root.foreground : root.dim
                font.family: root.fontFamily
                font.pixelSize: Style.font.display
              }
            }
          }

          Text {
            visible: svc.lastError !== ""
            width: parent.width
            text: svc.lastError
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

              PanelSectionHeader {
                text: String(modelData.brand || "Other").toUpperCase()
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
            visible: !svc.hasDevices && svc.lastError === ""
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

  Timer {
    interval: 5000
    running: root.opened && svc.hasDevices
    repeat: true
    onTriggered: phraseSwap.restart()
  }

  SequentialAnimation {
    id: phraseSwap
    PropertyAnimation {
      target: hero
      property: "metaOpacity"
      to: 0.0
      duration: 180
      easing.type: Easing.OutQuad
    }
    ScriptAction {
      script: root.phraseIndex = (root.phraseIndex + 1) % root.activePhrases.length
    }
    PropertyAnimation {
      target: hero
      property: "metaOpacity"
      to: 1.0
      duration: 260
      easing.type: Easing.InQuad
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
        text: Model.kindGlyph(batteryRow.device.kind)
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.title
        width: Style.space(22)
        horizontalAlignment: Text.AlignHCenter
        anchors.verticalCenter: parent.verticalCenter
      }

      Text {
        text: Model.displayName(batteryRow.device)
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.body
        elide: Text.ElideRight
        width: Math.max(0, parent.width - Style.space(22) - Style.space(8) - Style.space(64) - Style.space(8))
        anchors.verticalCenter: parent.verticalCenter
      }

      Text {
        text: Model.levelDisplayText(batteryRow.device, root.levelDisplay)
        color: batteryRow.low ? root.urgent : Qt.darker(root.foreground, 1.4)
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        font.bold: true
        width: Style.space(64)
        horizontalAlignment: Text.AlignRight
        anchors.verticalCenter: parent.verticalCenter

        MouseArea {
          anchors.fill: parent
          cursorShape: Qt.PointingHandCursor
          onClicked: root.cycleLevelDisplay()
        }
      }
    }
  }
}
