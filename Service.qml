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

  // A helper that lists an implausible number of devices should not be able to
  // queue an unbounded run of toasts.
  readonly property int notifyQueueLimit: 8

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
    var plan = Model.notifyPlan(list, notified, {
      low: lowBatteryPercent,
      critical: criticalBatteryPercent,
      repeatMinutes: notifyRepeatMinutes,
      now: Date.now()
    })
    notified = plan.state
    for (var i = 0; i < plan.due.length; i++)
      sendNotify(plan.due[i].device, plan.due[i].tier)
  }

  // The notification card draws the glyph, summary and body but never the app
  // name, so the headline is what identifies us. omarchy-notification-send is
  // preferred over notify-send: it hands every value to Notify as one typed
  // D-Bus argument, so a device name read off a HID descriptor can never be
  // reparsed as an option or a hint. The app name still has to be set, or the
  // shell files the toast as ephemeral and drops it from the history panel.
  readonly property string notifierPath:
    (Quickshell.env("OMARCHY_PATH") || "/usr/share/omarchy") + "/bin/omarchy-notification-send"

  // One Process sends one notification at a time, so a batch has to queue.
  // Dropping the overflow would leave a device silently unwarned for good:
  // maybeNotify has already recorded it as notified, and at the default repeat
  // of 0 it would never be due again until the battery recovers and falls back.
  property var notifyQueue: []

  function sendNotify(dev, tier) {
    var queue = notifyQueue.slice()
    if (queue.length >= notifyQueueLimit) return
    queue.push([notifierPath,
      "-u", tier === "crit" ? "critical" : "normal",
      "-g", Model.kindGlyph(dev.kind),
      "--app-name", "Peripheral Batteries",
      Model.notifyHeadline(tier), Model.notifyBody(dev)])
    notifyQueue = queue
    drainNotifyQueue()
  }

  function drainNotifyQueue() {
    if (notifyProcess.running || notifyQueue.length === 0) return
    var queue = notifyQueue.slice()
    var command = queue.shift()
    notifyQueue = queue
    notifyProcess.command = command
    notifyProcess.running = true
  }

  // The bar assigns settings one event-loop turn after the component is built,
  // so polling on completion would read the stock helper path and the stock
  // thresholds. The first is merely wasteful; the second can fire the very
  // alert a user lowered lowBatteryPercent to avoid. Wait for the assignment,
  // which the host makes even for an entry that carries no settings, and let
  // the fallback cover a host that never makes one.
  property bool settingsApplied: false
  property bool completed: false

  function applySettings() {
    if (settingsApplied) return
    settingsApplied = true
    refresh()
  }

  // The `settings: root.settings` binding evaluates the stock empty object while
  // this component is still initializing, so only an assignment that lands after
  // completion is the host's.
  onSettingsChanged: if (completed) applySettings()

  Component.onCompleted: {
    completed = true
    firstPollFallback.restart()
  }

  Timer {
    id: firstPollFallback
    interval: 2000
    onTriggered: root.applySettings()
  }

  Timer {
    interval: Math.max(5, root.refreshIntervalSec) * 1000
    running: root.enabled && root.settingsApplied
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
    onExited: root.drainNotifyQueue()
  }
}
