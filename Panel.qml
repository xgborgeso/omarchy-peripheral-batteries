import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
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
  readonly property string heroTitle: svc.devices.length === 1
    ? (svc.devices[0].name || "Peripherals")
    : "Peripherals"
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
          spacing: Style.spacing.xxxl

          PanelHero {
            id: hero
            width: parent.width
            title: root.heroTitle
            meta: root.heroMeta
            foreground: root.foreground
            fontFamily: root.fontFamily
            iconOpacity: svc.hasDevices ? 1.0 : 0.5
            iconComponent: Component {
              PeripheralsIcon {
                iconSize: Style.font.display
                color: svc.hasDevices ? root.foreground : root.dim
              }
            }
          }

          Text {
            visible: svc.lastError !== ""
            width: parent.width
            text: svc.lastError
            color: root.urgent
            font.family: root.fontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.WordWrap
          }

          Column {
            visible: svc.hasDevices
            width: parent.width
            spacing: Style.spacing.md

            PanelSectionHeader {
              text: "BATTERY"
              foreground: root.foreground
              fontFamily: root.fontFamily
            }

            Repeater {
              model: svc.devices
              BatteryRow {
                required property var modelData
                width: parent.width
                device: modelData
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
    implicitHeight: rowColumn.implicitHeight

    Column {
      id: rowColumn
      anchors.left: parent.left
      anchors.right: parent.right
      spacing: Style.spacing.xs

      Text {
        width: parent.width
        text: Model.rowLabel(batteryRow.device)
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.bodySmall
        wrapMode: Text.WordWrap
      }

      Text {
        width: parent.width
        visible: Model.rowCaption(batteryRow.device) !== ""
        text: Model.rowCaption(batteryRow.device)
        color: root.dim
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        wrapMode: Text.WordWrap
      }

      RowLayout {
        width: parent.width
        spacing: Style.spacing.lg

        Rectangle {
          id: meterTrack
          Layout.fillWidth: true
          Layout.alignment: Qt.AlignVCenter
          implicitHeight: Style.space(6)
          radius: height / 2
          color: Qt.darker(root.foreground, 3.2)

          Rectangle {
            id: meterFill
            width: meterTrack.width * Model.levelFraction(batteryRow.device.level)
            height: parent.height
            radius: parent.radius
            color: batteryRow.low ? root.urgent : root.foreground
          }

          Rectangle {
            anchors.fill: meterFill
            radius: meterFill.radius
            color: meterTrack.color
            visible: batteryRow.device.charging
            opacity: 0

            SequentialAnimation on opacity {
              running: batteryRow.device.charging
              loops: Animation.Infinite
              NumberAnimation { from: 0.0; to: 0.55; duration: 900; easing.type: Easing.InOutQuad }
              NumberAnimation { from: 0.55; to: 0.0; duration: 900; easing.type: Easing.InOutQuad }
            }
          }
        }

        Text {
          text: Model.levelText(batteryRow.device.level)
          color: root.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.bodySmall
          horizontalAlignment: Text.AlignRight
          Layout.preferredWidth: Style.space(38)
        }
      }
    }
  }
}
