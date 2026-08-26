// Parsing and formatting stay outside QML so the data contract is easy to test.

var LEVEL_UNKNOWN = -1
var SUPPORTED_SCHEMA = 1

function defaultDevice() {
  return {
    id: "",
    name: "",
    kind: "unknown",
    transport: "unknown",
    level: LEVEL_UNKNOWN,
    charging: false,
    available: false
  }
}

function defaultStatus() {
  return {
    ok: false,
    devices: [],
    lastError: "",
    schemaTooNew: false
  }
}

function integer(value, fallback) {
  var n = parseInt(value, 10)
  return isFinite(n) ? n : fallback
}

function device(raw) {
  var value = defaultDevice()
  if (!raw || typeof raw !== "object") return value
  value.id = String(raw.id || "")
  value.name = String(raw.name || "")
  value.kind = String(raw.kind || "unknown")
  value.transport = String(raw.transport || "unknown")
  var level = integer(raw.level, LEVEL_UNKNOWN)
  value.level = (level >= 0 && level <= 100) ? level : LEVEL_UNKNOWN
  value.charging = raw.charging === true
  value.available = raw.available === true && value.level !== LEVEL_UNKNOWN
  return value
}

function parseStatus(raw) {
  var status = defaultStatus()
  var text = String(raw || "").trim()
  if (text === "") {
    status.lastError = "The peripherals helper returned no status"
    return status
  }

  var parsed
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    status.lastError = "Could not read the peripherals status"
    return status
  }
  if (!parsed || typeof parsed !== "object") {
    status.lastError = "The peripherals helper returned an invalid status"
    return status
  }

  var version = integer(parsed.schema_version, 0)
  if (version > SUPPORTED_SCHEMA) {
    status.schemaTooNew = true
    status.lastError = "Peripherals status schema " + version + " is newer than this plugin"
    return status
  }

  if (parsed.ok === false) {
    status.lastError = errorText(parsed.error || "The peripherals helper failed")
    return status
  }

  status.ok = true
  var list = Array.isArray(parsed.devices) ? parsed.devices : []
  var devices = []
  for (var i = 0; i < list.length; i++) devices.push(device(list[i]))
  status.devices = devices
  status.lastError = errorText(parsed.error)
  return status
}

function levelText(level) {
  return level === LEVEL_UNKNOWN ? "--" : String(level) + "%"
}

function levelFraction(level) {
  if (level === LEVEL_UNKNOWN) return 0
  return Math.max(0, Math.min(100, level)) / 100
}

function kindLabel(kind) {
  if (kind === "mouse") return "Mouse"
  if (kind === "keyboard") return "Keyboard"
  if (kind === "headset") return "Headset"
  if (kind === "controller") return "Controller"
  return "Device"
}

function transportLabel(transport) {
  if (transport === "lightspeed") return "Lightspeed"
  if (transport === "bolt") return "Bolt"
  if (transport === "unifying") return "Unifying"
  if (transport === "bluetooth") return "Bluetooth"
  if (transport === "usb") return "USB"
  return ""
}

function rowLabel(dev) {
  if (!dev) return kindLabel("unknown")
  var kind = kindLabel(dev.kind)
  if (dev.name) return dev.name
  return kind
}

function lowestLevel(devices) {
  var lowest = LEVEL_UNKNOWN
  for (var i = 0; i < devices.length; i++) {
    var level = devices[i].level
    if (level === LEVEL_UNKNOWN) continue
    if (lowest === LEVEL_UNKNOWN || level < lowest) lowest = level
  }
  return lowest
}

function anyLow(devices, threshold) {
  for (var i = 0; i < devices.length; i++) {
    if (devices[i].level !== LEVEL_UNKNOWN && devices[i].level <= threshold && !devices[i].charging)
      return true
  }
  return false
}

function errorText(value) {
  var text = String(value || "").replace(/\s+/g, " ").trim()
  return text.length > 180 ? text.substring(0, 177) + "…" : text
}

if (typeof module !== "undefined") {
  module.exports = {
    LEVEL_UNKNOWN: LEVEL_UNKNOWN,
    defaultDevice: defaultDevice,
    defaultStatus: defaultStatus,
    parseStatus: parseStatus,
    device: device,
    levelText: levelText,
    levelFraction: levelFraction,
    kindLabel: kindLabel,
    transportLabel: transportLabel,
    rowLabel: rowLabel,
    lowestLevel: lowestLevel,
    anyLow: anyLow,
    errorText: errorText
  }
}
