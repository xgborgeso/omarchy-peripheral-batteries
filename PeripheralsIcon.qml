import QtQuick
import qs.Commons

// Geometric mouse + headset mark, inked with the theme colour so
// omarchy theme set restyles it. No image asset.
Item {
  id: root

  property real iconSize: 16
  property color color: Color.foreground

  implicitWidth: iconSize
  implicitHeight: iconSize

  readonly property real u: iconSize / 16

  // Mouse body
  Rectangle {
    x: 1.5 * root.u
    y: 6.5 * root.u
    width: 8 * root.u
    height: 6.5 * root.u
    radius: 2.2 * root.u
    color: root.color
  }

  Rectangle {
    x: 4.7 * root.u
    y: 6.5 * root.u
    width: 1.4 * root.u
    height: 3.2 * root.u
    color: root.color
    opacity: 0.35
  }

  // Headset bow
  Rectangle {
    x: 8.2 * root.u
    y: 2.2 * root.u
    width: 6.2 * root.u
    height: 6.2 * root.u
    radius: width / 2
    color: "transparent"
    border.width: Math.max(1, 1.4 * root.u)
    border.color: root.color
  }

  Rectangle {
    x: 7.6 * root.u
    y: 5.6 * root.u
    width: 2.2 * root.u
    height: 3.6 * root.u
    radius: 0.8 * root.u
    color: root.color
  }

  Rectangle {
    x: 12.8 * root.u
    y: 5.6 * root.u
    width: 2.2 * root.u
    height: 3.6 * root.u
    radius: 0.8 * root.u
    color: root.color
  }
}
