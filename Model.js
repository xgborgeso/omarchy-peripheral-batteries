// Parsing and formatting stay outside QML so the data contract is easy to test.

var LEVEL_UNKNOWN = -1
var SUPPORTED_SCHEMA = 1

function defaultDevice() {
  return {
    id: "",
    name: "",
    brand: "",
    kind: "unknown",
    transport: "unknown",
    level: LEVEL_UNKNOWN,
    remaining_sec: LEVEL_UNKNOWN,
    status: "unknown",
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
  value.brand = String(raw.brand || "")
  value.kind = String(raw.kind || "unknown")
  value.transport = String(raw.transport || "unknown")
  var level = integer(raw.level, LEVEL_UNKNOWN)
  value.level = (level >= 0 && level <= 100) ? level : LEVEL_UNKNOWN
  var remaining = integer(raw.remaining_sec, LEVEL_UNKNOWN)
  value.remaining_sec = remaining > 0 ? remaining : LEVEL_UNKNOWN
  value.status = String(raw.status || "unknown")
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
  if (dev.name) return dev.name
  return kindLabel(dev.kind)
}

function rowCaption(dev) {
  if (!dev) return ""
  var kind = kindLabel(dev.kind)
  var transport = transportLabel(dev.transport)
  if (kind && transport) return kind + " · " + transport
  return kind || transport
}

function displayName(dev) {
  var name = String(dev && dev.name || "").trim()
  name = name.replace(/^(Logitech|Kingston|Razer|SteelSeries|Corsair|Microsoft|Apple|Sony|Samsung|HyperX)\s+/i, "")
  name = name.replace(/\s+Wireless$/i, "")
  return name || kindLabel(dev && dev.kind)
}

function kindGlyph(kind) {
  if (kind === "mouse") return "󰍽"
  if (kind === "keyboard") return "󰌌"
  if (kind === "headset") return "󰋋"
  if (kind === "controller") return "󰊗"
  return "󰂂"
}

function deviceBrand(dev) {
  var brand = String(dev && dev.brand || "").trim()
  if (brand) return brand
  var name = String(dev && dev.name || "")
  if (/logitech/i.test(name)) return "Logitech"
  return "Other"
}

function formatRemaining(seconds) {
  var n = integer(seconds, LEVEL_UNKNOWN)
  if (n <= 0) return "--"
  var minutes = Math.round(n / 60)
  if (minutes < 1) return "<1m"
  if (minutes < 60) return String(minutes) + "m"
  var hours = Math.floor(minutes / 60)
  var rest = minutes % 60
  if (rest === 0) return String(hours) + "h"
  return String(hours) + "h " + String(rest) + "m"
}

function statusLabel(status, charging) {
  if (charging === true || status === "charging") return "Charging"
  if (status === "full") return "Full"
  if (status === "discharging") return "In use"
  return "--"
}

function displayModes(devices) {
  var modes = ["percent"]
  var list = devices || []
  var hasRemaining = false
  var hasStatus = false
  for (var i = 0; i < list.length; i++) {
    if (integer(list[i].remaining_sec, LEVEL_UNKNOWN) > 0) hasRemaining = true
    if (list[i].status && list[i].status !== "unknown") hasStatus = true
    if (list[i].charging === true) hasStatus = true
  }
  if (hasRemaining) modes.push("remaining")
  if (hasStatus) modes.push("status")
  return modes
}

function nextDisplayMode(current, devices) {
  var modes = displayModes(devices)
  var at = modes.indexOf(current)
  if (at < 0) return modes[0]
  return modes[(at + 1) % modes.length]
}

function levelDisplayText(dev, mode) {
  if (mode === "remaining") return formatRemaining(dev && dev.remaining_sec)
  if (mode === "status") return statusLabel(dev && dev.status, dev && dev.charging)
  return levelText(dev && dev.level)
}

function brandGroups(devices) {
  var list = devices || []
  var order = []
  var map = {}
  for (var i = 0; i < list.length; i++) {
    var brand = deviceBrand(list[i])
    if (!map[brand]) {
      map[brand] = []
      order.push(brand)
    }
    map[brand].push(list[i])
  }
  var groups = []
  for (var g = 0; g < order.length; g++) {
    var brandName = order[g]
    var rows = map[brandName]
    var known = 0
    for (var r = 0; r < rows.length; r++) {
      if (rows[r].level !== LEVEL_UNKNOWN) known++
    }
    groups.push({
      brand: brandName,
      devices: rows,
      lowest: lowestLevel(rows),
      allKnown: rows.length > 0 && known === rows.length,
      headerShowsLevel: false
    })
  }
  return groups
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
    rowCaption: rowCaption,
    displayName: displayName,
    kindGlyph: kindGlyph,
    deviceBrand: deviceBrand,
    brandGroups: brandGroups,
    formatRemaining: formatRemaining,
    statusLabel: statusLabel,
    displayModes: displayModes,
    nextDisplayMode: nextDisplayMode,
    levelDisplayText: levelDisplayText,
    lowestLevel: lowestLevel,
    anyLow: anyLow,
    errorText: errorText
  }
}
