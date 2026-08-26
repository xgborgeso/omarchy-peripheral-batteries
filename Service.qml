import QtQuick
import Quickshell
import Quickshell.Io
import "Model.js" as Model

Item {
  id: root

  property var settings: ({})
  property bool enabled: true

  property var devices: []
  property string lastError: ""
  property bool helperMissing: false
  property bool refreshing: false

  readonly property int refreshIntervalSec: intSetting("refreshIntervalSec", 30, 5, 3600)
  readonly property int lowBatteryPercent: intSetting("lowBatteryPercent", 20, 5, 50)
  readonly property int criticalBatteryPercent: Math.min(intSetting("criticalBatteryPercent", 10, 1, 49), lowBatteryPercent - 1)
  readonly property bool notifyOnLow: setting("notifyOnLow", true) === true
  readonly property int notifyRepeatMinutes: intSetting("notifyRepeatMinutes", 0, 0, 720)
  readonly property bool busy: statusProcess.running || notifyProcess.running
  readonly property bool hasDevices: devices.length > 0
  readonly property bool hasBattery: {
    for (var i = 0; i < devices.length; i++) {
      if (devices[i].available) return true
    }
    return false
  }

  function toLocalFile(url) {
    var s = String(url || "").trim()
    if (s.indexOf("file:") === 0) {
      s = s.replace(/^file:\/\//i, "")
      s = s.replace(/^localhost/i, "")
      if (s.charAt(0) !== "/") s = "/" + s
      try { s = decodeURIComponent(s) } catch (e) {}
    }
    return s.replace(/\/+$/, "")
  }

  function helperScript() {
    var override = String(setting("helperPath", "") || "").trim()
    if (override) return override
    var resolved = toLocalFile(Qt.resolvedUrl("helper/status.py"))
    if (resolved.charAt(0) === "/") return resolved
    return toLocalFile(Qt.resolvedUrl(".")) + "/helper/status.py"
  }

  // id -> { tier: "warn"|"crit", atMs: number }
  property var notified: ({})

  function setting(name, fallback) {
    var value = settings ? settings[name] : undefined
    return value === undefined || value === null ? fallback : value
  }

  function intSetting(name, fallback, min, max) {
    var n = parseInt(String(setting(name, fallback)), 10)
    if (!isFinite(n)) n = fallback
    if (n < min) n = min
    if (n > max) n = max
    return n
  }

  function refresh() {
    if (!enabled || statusProcess.running) return
    refreshing = true
    statusProcess.command = ["python3", helperScript()]
    statusProcess.running = true
  }

  function applyStatus(raw) {
    var parsed = Model.parseStatus(raw)
    if (!parsed.ok) {
      lastError = parsed.lastError
      helperMissing = false
      return
    }
    lastError = parsed.lastError
    helperMissing = false
    devices = parsed.devices
    maybeNotify(parsed.devices)
  }

  function failedStatus(message) {
    var text = String(message || "")
    helperMissing = text.indexOf("No such file") >= 0 || text.indexOf("not found") >= 0
    lastError = helperMissing
      ? "Python 3 helper missing: " + helperScript()
      : Model.errorText(text || "Could not query peripherals")
  }

  function maybeNotify(list) {
    if (!notifyOnLow) return
    var now = Date.now()
    var next = Object.assign({}, notified)
    for (var i = 0; i < list.length; i++) {
      var dev = list[i]
      if (!dev.available || dev.level === Model.LEVEL_UNKNOWN) continue
      if (dev.charging || dev.level > lowBatteryPercent) {
        delete next[dev.id]
        continue
      }
      var tier = dev.level <= criticalBatteryPercent ? "crit" : "warn"
      var prev = next[dev.id]
      var due = !prev
        || (prev.tier === "warn" && tier === "crit")
        || (notifyRepeatMinutes > 0 && now - prev.atMs >= notifyRepeatMinutes * 60000)
      if (!due) continue
      next[dev.id] = { tier: tier, atMs: now }
      sendNotify(dev, tier)
    }
    notified = next
  }

  function sendNotify(dev, tier) {
    if (notifyProcess.running) return
    var urgency = tier === "crit" ? "critical" : "normal"
    var title = dev.name || Model.kindLabel(dev.kind)
    var body = "Battery " + Model.levelText(dev.level)
    notifyProcess.command = ["notify-send", "-u", urgency, "-a", "Peripheral Batteries", "--", title, body]
    notifyProcess.running = true
  }

  Component.onCompleted: refresh()

  Timer {
    interval: Math.max(5, root.refreshIntervalSec) * 1000
    running: root.enabled
    repeat: true
    onTriggered: root.refresh()
  }

  Process {
    id: statusProcess
    running: false
    command: []
    stdout: StdioCollector { id: statusStdout; waitForEnd: true }
    stderr: StdioCollector { id: statusStderr; waitForEnd: true }
    onExited: function (exitCode) {
      root.refreshing = false
      var stdout = String(statusStdout.text || "")
      var stderr = String(statusStderr.text || "")
      if (exitCode === 0) root.applyStatus(stdout)
      else root.failedStatus(stderr || stdout)
    }
  }

  Process {
    id: notifyProcess
    running: false
    command: []
  }
}
