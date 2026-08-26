import QtQuick
import QtQuick.Controls
import Quickshell
import qs.Commons
import qs.Ui as Ui
import "Model.js" as Model

Ui.Panel {
  id: root
  moduleName: "io.github.gabriel.peripheral-batteries"
  ipcTarget: "io.github.gabriel.peripheral-batteries"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  property var service: null
  readonly property var barIdentity: hostWidget || root
  readonly property var svc: service

  property int phraseIndex: 0

  readonly property int lowBatteryPercent: {
    var n = parseInt(String(setting("lowBatteryPercent", 20)), 10)
    return isFinite(n) ? n : 20
  }
  readonly property color urgent: bar ? bar.urgent : Color.urgent
  readonly property color dim: Qt.darker(barForeground, 1.55)
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property bool hasDevices: svc ? svc.hasDevices : false
  readonly property string lastError: svc ? String(svc.lastError || "") : ""
  readonly property bool helperMissing: svc ? svc.helperMissing === true : false

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
  readonly property string heroTitle: "Peripheral Batteries"
  readonly property var brandGroups: Model.brandGroups(svc ? svc.devices : [])
  readonly property string heroMeta: !hasDevices
    ? (helperMissing ? "Helper not built" : (lastError !== "" ? "Cannot read devices" : "Not connected"))
    : heroPhraseText

  function pickHeroPhrase() {
    var n = activePhrases.length
    if (n <= 0) return
    var next = Math.floor(Math.random() * n)
    if (next === phraseIndex && n > 1)
      next = (phraseIndex + 1 + Math.floor(Math.random() * (n - 1))) % n
    phraseIndex = next
  }

  function open() {
    root.controller.show()
  }

  function close() {
    root.controller.hide()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  onOpenedChanged: if (opened) {
    pickHeroPhrase()
    if (panelFlick) panelFlick.contentY = 0
    if (svc && typeof svc.refresh === "function") svc.refresh()
    Qt.callLater(function () { keyCatcher.forceActiveFocus() })
  }

  Ui.KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
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
        if (String(text).toLowerCase() === "r" && svc && typeof svc.refresh === "function")
          svc.refresh()
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
            title: root.heroTitle
            meta: root.heroMeta
            foreground: root.barForeground
            fontFamily: root.fontFamily
            iconOpacity: root.hasDevices ? 1.0 : 0.5
            iconComponent: Component {
              Text {
                text: "󰂂"
                color: root.hasDevices ? root.barForeground : root.dim
                font.family: root.fontFamily
                font.pixelSize: Style.font.display
              }
            }
          }

          Text {
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
                visible: modelData.headerShowsBrand === true && String(modelData.brand || "") !== ""
                text: String(modelData.brand || "").toUpperCase()
                foreground: root.barForeground
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
        text: Model.kindGlyph(batteryRow.device.kind)
        color: root.barForeground
        font.family: root.fontFamily
        font.pixelSize: Style.font.title
        width: Style.space(22)
        horizontalAlignment: Text.AlignHCenter
        anchors.verticalCenter: parent.verticalCenter
      }

      Text {
        text: Model.displayName(batteryRow.device)
        color: root.barForeground
        font.family: root.fontFamily
        font.pixelSize: Style.font.body
        elide: Text.ElideRight
        width: Math.max(0, parent.width - Style.space(22) - Style.space(8) - Style.space(48) - Style.space(8))
        anchors.verticalCenter: parent.verticalCenter
      }

      Text {
        text: Model.levelText(batteryRow.device.level)
        color: batteryRow.low ? root.urgent : Qt.darker(root.barForeground, 1.4)
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
