// Parsing and formatting stay outside QML so the data contract is easy to test.

var LEVEL_UNKNOWN = -1
var SUPPORTED_SCHEMA = 1
var ERROR_LIMIT = 160

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

// Helper fields arrive as JSON numbers. Anything else is a malformed field and
// takes the fallback rather than parseInt's leading-digit salvage.
function toInt(value, fallback) {
  if (typeof value === "number") return isFinite(value) ? Math.round(value) : fallback
  var text = value === null || value === undefined ? "" : String(value).trim()
  if (text === "") return fallback
  var n = Number(text)
  return isFinite(n) ? Math.round(n) : fallback
}

function isKnownLevel(level) {
  return typeof level === "number" && level >= 0 && level <= 100
}

function isHumanName(name) {
  var n = String(name || "").trim()
  if (!n) return false
  if (/^[0-9A-Fa-f]{4}:[0-9A-Fa-f]{4}$/.test(n)) return false
  var lower = n.toLowerCase()
  if (lower.indexOf("hidpp_battery") === 0) return false
  if (lower.indexOf("hidraw") === 0) return false
  return true
}

function isHumanBrand(brand) {
  var b = String(brand || "").trim()
  if (!b) return false
  var lower = b.toLowerCase()
  return lower !== "other" && lower !== "unknown"
}

function assignPlaceholders(devices) {
  var list = devices || []
  var need = []
  for (var i = 0; i < list.length; i++) {
    if (!isHumanBrand(list[i].brand)) list[i].brand = ""
    if (!isHumanName(list[i].name)) need.push(list[i])
  }
  need.sort(function (a, b) {
    var kind = String(a.kind || "unknown").localeCompare(String(b.kind || "unknown"))
    if (kind !== 0) return kind
    return String(a.id || "").localeCompare(String(b.id || ""))
  })
  var counts = {}
  for (var n = 0; n < need.length; n++) {
    var kindKey = need[n].kind || "unknown"
    counts[kindKey] = (counts[kindKey] || 0) + 1
    need[n].name = kindLabel(kindKey) + " " + counts[kindKey]
  }
  return list
}

function device(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  var value = defaultDevice()
  value.id = String(raw.id || "")
  value.kind = String(raw.kind || "unknown") || "unknown"
  value.transport = String(raw.transport || "unknown") || "unknown"
  value.brand = String(raw.brand || "").trim()
  value.name = String(raw.name || "").trim()
  var level = toInt(raw.level, LEVEL_UNKNOWN)
  value.level = (level >= 0 && level <= 100) ? level : LEVEL_UNKNOWN
  var remaining = toInt(raw.remaining_sec, LEVEL_UNKNOWN)
  value.remaining_sec = remaining > 0 ? remaining : LEVEL_UNKNOWN
  value.status = String(raw.status || "unknown")
  value.charging = raw.charging === true
  value.available = raw.available === true && value.level !== LEVEL_UNKNOWN
  if (!value.id && value.level === LEVEL_UNKNOWN && !value.name) return null
  return value
}

function statusError(message, schemaTooNew) {
  var status = defaultStatus()
  status.lastError = message
  status.schemaTooNew = schemaTooNew === true
  return status
}

function parseStatus(raw) {
  var text = raw === null || raw === undefined ? "" : String(raw).trim()
  if (text === "") return statusError("The peripherals helper printed nothing")

  var payload
  try {
    payload = JSON.parse(text)
  } catch (err) {
    return statusError("The peripherals helper printed something that is not JSON")
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return statusError("The peripherals helper printed a status that is not an object")

  var schema = toInt(payload.schema_version, 0)
  if (schema > SUPPORTED_SCHEMA)
    return statusError("This plugin reads status schema " + SUPPORTED_SCHEMA
      + ", the helper sent " + schema, true)

  if (payload.ok === false)
    return statusError(errorText(payload.error) || "The peripherals helper reported a failure")

  var rows = []
  var list = Array.isArray(payload.devices) ? payload.devices : []
  for (var i = 0; i < list.length; i++) {
    var row = device(list[i])
    if (row) rows.push(row)
  }

  var status = defaultStatus()
  status.ok = true
  status.devices = assignPlaceholders(rows)
  status.lastError = errorText(payload.error)
  return status
}

function levelText(level) {
  return isKnownLevel(level) ? level + "%" : "--"
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
  if (/^(Mouse|Keyboard|Headset|Controller|Device) \d+$/.test(name)) return name
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
  return isHumanBrand(brand) ? brand : ""
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
      headerShowsLevel: false,
      headerShowsBrand: brandName !== ""
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

// Helper stderr can be a whole traceback. The panel gets one line, cut on a word
// boundary so the tail is not a half-word.
function errorText(value) {
  var text = (value === null || value === undefined ? "" : String(value)).split(/\s+/).join(" ").trim()
  if (text.length <= ERROR_LIMIT) return text
  return text.slice(0, ERROR_LIMIT).replace(/\s+\S*$/, "") + "..."
}

if (typeof module !== "undefined") {
  module.exports = {
    LEVEL_UNKNOWN: LEVEL_UNKNOWN,
    defaultDevice: defaultDevice,
    defaultStatus: defaultStatus,
    parseStatus: parseStatus,
    device: device,
    isHumanName: isHumanName,
    isHumanBrand: isHumanBrand,
    assignPlaceholders: assignPlaceholders,
    levelText: levelText,
    kindLabel: kindLabel,
    transportLabel: transportLabel,
    rowLabel: rowLabel,
    rowCaption: rowCaption,
    displayName: displayName,
    kindGlyph: kindGlyph,
    deviceBrand: deviceBrand,
    brandGroups: brandGroups,
    lowestLevel: lowestLevel,
    anyLow: anyLow,
    errorText: errorText
  }
}
