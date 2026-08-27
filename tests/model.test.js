const assert = require("assert")
const Model = require("../Model.js")

function sample() {
  return JSON.stringify({
    ok: true,
    schema_version: 1,
    error: "",
    devices: [
      {
        id: "pack:aa-bb-cc-dd",
        name: "Logitech PRO X",
        kind: "mouse",
        brand: "Logitech",
        transport: "lightspeed",
        level: 77,
        remaining_sec: -1,
        status: "discharging",
        charging: false,
        available: true
      },
      {
        id: "hid:046d:0af7",
        name: "Logitech PRO X 2 LIGHTSPEED",
        kind: "headset",
        brand: "Logitech",
        transport: "lightspeed",
        level: -1,
        charging: false,
        available: false
      }
    ]
  })
}

const ok = Model.parseStatus(sample())
assert.strictEqual(ok.ok, true)
assert.strictEqual(ok.devices.length, 2)
assert.strictEqual(ok.devices[0].level, 77)
assert.strictEqual(ok.devices[1].level, Model.LEVEL_UNKNOWN)
assert.strictEqual(Model.levelText(ok.devices[1].level), "--")
assert.strictEqual(Model.lowestLevel(ok.devices), 77)
assert.strictEqual(Model.anyLow(ok.devices, 20), false)
assert.strictEqual(Model.transportLabel("lightspeed"), "Lightspeed")
assert.strictEqual(Model.rowCaption(ok.devices[1]), "Headset · Lightspeed")
assert.strictEqual(Model.rowLabel(ok.devices[1]), "Logitech PRO X 2 LIGHTSPEED")
assert.strictEqual(Model.displayName(ok.devices[0]), "PRO X")
assert.strictEqual(Model.displayName(ok.devices[1]), "PRO X 2 LIGHTSPEED")
assert.strictEqual(Model.kindGlyph("headset"), "󰋋")
const groups = Model.brandGroups(ok.devices)
assert.strictEqual(groups.length, 1)
assert.strictEqual(groups[0].brand, "Logitech")
assert.strictEqual(groups[0].devices.length, 2)
assert.strictEqual(groups[0].allKnown, false)
assert.strictEqual(groups[0].headerShowsLevel, false)
assert.strictEqual(groups[0].headerShowsBrand, true)

const bothKnown = Model.parseStatus(JSON.stringify({
  ok: true,
  schema_version: 1,
  devices: [
    { id: "mouse", name: "Logitech PRO X", brand: "Logitech", kind: "mouse", level: 75, status: "discharging", available: true },
    { id: "headset", name: "Logitech PRO X 2 LIGHTSPEED", brand: "Logitech", kind: "headset", level: 67, status: "discharging", available: true }
  ]
}))
assert.strictEqual(bothKnown.devices[0].level, 75)
assert.strictEqual(bothKnown.devices[1].level, 67)
assert.strictEqual(Model.levelText(bothKnown.devices[0].level), "75%")
assert.strictEqual(Model.levelText(bothKnown.devices[1].level), "67%")
const logitech = Model.brandGroups(bothKnown.devices)
assert.strictEqual(logitech.length, 1)
assert.strictEqual(logitech[0].headerShowsLevel, false)
assert.strictEqual(logitech[0].headerShowsBrand, true)
assert.strictEqual(logitech[0].devices[0].level !== logitech[0].devices[1].level, true)
assert.strictEqual(ok.devices[0].remaining_sec, Model.LEVEL_UNKNOWN)
assert.strictEqual(Model.levelText(ok.devices[0].level), "77%")
assert.strictEqual(typeof Model.displayModes, "undefined")
assert.strictEqual(typeof Model.nextDisplayMode, "undefined")
assert.strictEqual(typeof Model.levelDisplayText, "undefined")
assert.strictEqual(typeof Model.estimatedRemainingSec, "undefined")
assert.strictEqual(typeof Model.formatRemaining, "undefined")
assert.strictEqual(typeof Model.statusLabel, "undefined")

const empty = Model.parseStatus("")
assert.strictEqual(empty.ok, false)
assert.ok(empty.lastError)

const bad = Model.parseStatus("not-json")
assert.strictEqual(bad.ok, false)

const tooNew = Model.parseStatus(JSON.stringify({ ok: true, schema_version: 99, devices: [] }))
assert.strictEqual(tooNew.schemaTooNew, true)

const failed = Model.parseStatus(JSON.stringify({ ok: false, schema_version: 1, error: "boom", devices: [] }))
assert.strictEqual(failed.ok, false)
assert.ok(failed.lastError.indexOf("boom") >= 0)

const laptopExcluded = Model.parseStatus(JSON.stringify({ ok: true, schema_version: 1, devices: [] }))
assert.strictEqual(laptopExcluded.devices.length, 0)

function parseDevices(devices) {
  return Model.parseStatus(JSON.stringify({ ok: true, schema_version: 1, devices: devices }))
}

function labels(status) {
  return status.devices.map(function (d) { return Model.displayName(d) })
}

const unnamed = parseDevices([
  { id: "pack:anon", name: "", brand: "", kind: "", level: 42, available: true },
  "not-a-device",
  null
])
assert.strictEqual(unnamed.ok, true)
assert.strictEqual(unnamed.devices.length, 1)
assert.strictEqual(unnamed.devices[0].brand, "")
assert.strictEqual(unnamed.devices[0].kind, "unknown")
assert.strictEqual(Model.displayName(unnamed.devices[0]), "Device 1")
assert.strictEqual(Model.deviceBrand(unnamed.devices[0]), "")
assert.strictEqual(Model.kindGlyph("unknown"), "󰂂")
assert.strictEqual(Model.levelText(unnamed.devices[0].level), "42%")
const unbranded = Model.brandGroups(unnamed.devices)
assert.strictEqual(unbranded.length, 1)
assert.strictEqual(unbranded[0].brand, "")
assert.strictEqual(unbranded[0].headerShowsBrand, false)

const razer = parseDevices([
  { id: "r", name: "DeathAdder V3 Pro", brand: "Razer", kind: "unknown", level: 80, available: true }
])
assert.strictEqual(Model.displayName(razer.devices[0]), "DeathAdder V3 Pro")
assert.strictEqual(Model.deviceBrand(razer.devices[0]), "Razer")
assert.strictEqual(Model.kindGlyph(razer.devices[0].kind), "󰂂")

const twoMice = parseDevices([
  { id: "pack:b", name: "", kind: "mouse", level: 10, available: true },
  { id: "pack:a", name: "", kind: "mouse", level: 20, available: true }
])
assert.strictEqual(Model.displayName(twoMice.devices.find(function (d) { return d.id === "pack:a" })), "Mouse 1")
assert.strictEqual(Model.displayName(twoMice.devices.find(function (d) { return d.id === "pack:b" })), "Mouse 2")

const twoHeadsets = parseDevices([
  { id: "h1", name: "", kind: "headset", level: 1, available: true },
  { id: "h2", name: "", kind: "headset", level: 2, available: true }
])
assert.deepStrictEqual(labels(twoHeadsets), ["Headset 1", "Headset 2"])

const kinds = parseDevices([
  { id: "k", name: "", kind: "keyboard", level: 1, available: true },
  { id: "c", name: "", kind: "controller", level: 2, available: true },
  { id: "m", name: "", kind: "mouse", level: 3, available: true },
  { id: "h", name: "", kind: "headset", level: 4, available: true }
])
assert.deepStrictEqual(labels(kinds).sort(), ["Controller 1", "Headset 1", "Keyboard 1", "Mouse 1"])

const mixed = parseDevices([
  { id: "named", name: "Logitech PRO X", brand: "Logitech", kind: "mouse", level: 75, available: true },
  { id: "anon", name: "", brand: "", kind: "mouse", level: 40, available: true }
])
assert.strictEqual(Model.displayName(mixed.devices.find(function (d) { return d.id === "named" })), "PRO X")
assert.strictEqual(Model.displayName(mixed.devices.find(function (d) { return d.id === "anon" })), "Mouse 1")
const mixedGroups = Model.brandGroups(mixed.devices)
assert.strictEqual(mixedGroups.length, 2)
assert.ok(mixedGroups.some(function (g) { return g.brand === "Logitech" && g.headerShowsBrand === true }))
assert.ok(mixedGroups.some(function (g) { return g.brand === "" && g.headerShowsBrand === false }))

assert.deepStrictEqual(labels(parseDevices([
  { id: "s", name: "hidpp_battery_0", kind: "unknown", level: 5, available: true }
])), ["Device 1"])
assert.deepStrictEqual(labels(parseDevices([
  { id: "v", name: "046D:4093", kind: "mouse", level: 5, available: true }
])), ["Mouse 1"])
assert.deepStrictEqual(labels(parseDevices([
  { id: "w", name: "   ", kind: "headset", level: 5, available: true }
])), ["Headset 1"])
assert.strictEqual(parseDevices([
  { id: "o", name: "", brand: "Other", kind: "mouse", level: 9, available: true }
]).devices[0].brand, "")
assert.strictEqual(parseDevices([
  { id: "u", name: "", brand: "unknown", kind: "mouse", level: 9, available: true }
]).devices[0].brand, "")

const noDevicesKey = Model.parseStatus(JSON.stringify({ ok: true, schema_version: 1 }))
assert.strictEqual(noDevicesKey.ok, true)
assert.strictEqual(noDevicesKey.devices.length, 0)

const devicesNotList = Model.parseStatus(JSON.stringify({ ok: true, schema_version: 1, devices: {} }))
assert.strictEqual(devicesNotList.ok, true)
assert.strictEqual(devicesNotList.devices.length, 0)

const onlyJunk = parseDevices([null, "x", 1, []])
assert.strictEqual(onlyJunk.ok, true)
assert.strictEqual(onlyJunk.devices.length, 0)
assert.strictEqual(onlyJunk.lastError, "")

const weirdLevel = parseDevices([{ id: "x", name: "Keep Me", brand: "Razer", kind: "mouse", level: 101, available: true }])
assert.strictEqual(Model.displayName(weirdLevel.devices[0]), "Keep Me")
assert.strictEqual(Model.levelText(weirdLevel.devices[0].level), "--")

const zero = parseDevices([{ id: "z", name: "Named", brand: "Sony", kind: "controller", level: 0, available: true }])
assert.strictEqual(Model.levelText(zero.devices[0].level), "0%")
assert.strictEqual(Model.displayName(zero.devices[0]), "Named")

assert.strictEqual(Model.rowLabel(twoMice.devices.find(function (d) { return d.id === "pack:a" })), "Mouse 1")
assert.ok(twoMice.devices.every(function (d) { return Model.displayName(d) !== "" }))
assert.doesNotThrow(function () {
  Model.parseStatus(JSON.stringify({ ok: true, schema_version: 1, devices: [{ extra: true }] }))
})
assert.strictEqual(Model.isHumanName(""), false)
assert.strictEqual(Model.isHumanName("046D:4093"), false)
assert.strictEqual(Model.isHumanName("hidpp_battery_0"), false)
assert.strictEqual(Model.isHumanName("hidraw3"), false)
assert.strictEqual(Model.isHumanName("Wireless Mouse"), true)
assert.strictEqual(Model.isHumanBrand(""), false)
assert.strictEqual(Model.isHumanBrand("Other"), false)
assert.strictEqual(Model.isHumanBrand("unknown"), false)
assert.strictEqual(Model.isHumanBrand("Logitech"), true)

console.log("model.test.js ok")

// --- low-battery notification rules -----------------------------------------
// These mirror the shell behaviour verified against a live Omarchy notification
// server: one alert per device per tier, escalation from warn to crit, silence
// while charging, and a fresh alert only after the battery recovers.

function dev(id, level, extra) {
  var d = { id: id, name: id, kind: "mouse", level: level, charging: false, available: true }
  for (var k in extra || {}) d[k] = extra[k]
  return d
}

const OPTS = { low: 20, critical: 10, repeatMinutes: 0, now: 1000 }
function plan(devices, state, over) {
  var o = {}
  for (var k in OPTS) o[k] = OPTS[k]
  for (var k2 in over || {}) o[k2] = over[k2]
  return Model.notifyPlan(devices, state, o)
}

// A healthy device is silent and holds no state.
var healthy = plan([dev("m", 60)], {})
assert.strictEqual(healthy.due.length, 0)
assert.strictEqual(Object.keys(healthy.state).length, 0)

// Crossing the warning threshold notifies exactly once.
var warn = plan([dev("m", 15)], {})
assert.strictEqual(warn.due.length, 1)
assert.strictEqual(warn.due[0].tier, "warn")
assert.strictEqual(plan([dev("m", 15)], warn.state).due.length, 0)

// Falling to the critical threshold escalates, then goes quiet again.
var crit = plan([dev("m", 8)], warn.state)
assert.strictEqual(crit.due.length, 1)
assert.strictEqual(crit.due[0].tier, "crit")
assert.strictEqual(plan([dev("m", 8)], crit.state).due.length, 0)

// Crit does not de-escalate back to warn on a small rebound below the threshold.
assert.strictEqual(plan([dev("m", 15)], crit.state).due.length, 0)

// Recovering above the threshold clears the state, so the next drop warns again.
var recovered = plan([dev("m", 60)], crit.state)
assert.strictEqual(recovered.due.length, 0)
assert.strictEqual(recovered.state["m"], undefined)
assert.strictEqual(plan([dev("m", 8)], recovered.state).due.length, 1)

// A charging device is never warned, and charging clears a prior alert.
assert.strictEqual(plan([dev("m", 5, { charging: true })], {}).due.length, 0)
assert.strictEqual(plan([dev("m", 5, { charging: true })], crit.state).state["m"], undefined)

// Devices with no readable level, or that are away, are skipped without
// disturbing state they already had.
assert.strictEqual(plan([dev("m", Model.LEVEL_UNKNOWN)], {}).due.length, 0)
assert.strictEqual(plan([dev("m", 5, { available: false })], {}).due.length, 0)
assert.strictEqual(plan([dev("m", Model.LEVEL_UNKNOWN)], crit.state).state["m"].tier, "crit")

// Every low device in one batch is due, not just the first. Regression: the
// sender used to drop the rest of the batch while already recording them as
// notified, which silenced them until the battery recovered.
var batch = plan([dev("a", 12), dev("b", 14), dev("c", 8)], {})
assert.strictEqual(batch.due.length, 3)
assert.deepStrictEqual(batch.due.map(function (d) { return d.device.id }), ["a", "b", "c"])
assert.deepStrictEqual(batch.due.map(function (d) { return d.tier }), ["warn", "warn", "crit"])

// repeatMinutes = 0 never re-notifies; a positive value re-notifies only once
// the interval has fully elapsed.
assert.strictEqual(plan([dev("m", 15)], warn.state, { now: 1000 + 3600000 }).due.length, 0)
assert.strictEqual(plan([dev("m", 15)], warn.state, { repeatMinutes: 1, now: 1000 + 59000 }).due.length, 0)
assert.strictEqual(plan([dev("m", 15)], warn.state, { repeatMinutes: 1, now: 1000 + 60000 }).due.length, 1)

// The headline carries the identity, because Omarchy's notification card never
// renders the app name; the body carries the device and its level.
assert.strictEqual(Model.notifyHeadline("warn"), "Peripheral battery low")
assert.strictEqual(Model.notifyHeadline("crit"), "Peripheral battery critical")
assert.strictEqual(Model.notifyBody(dev("m", 15)), "m · 15%")
assert.strictEqual(Model.notifyBody({ kind: "headset", level: 8 }), "Headset · 8%")

// --- hostile device identity ---------------------------------------------------
// A USB or Bluetooth peripheral chooses its own product and manufacturer strings,
// so every field here is attacker-controlled. The panel pins its Text elements to
// Text.PlainText, but the values are filtered too, so no single sink is load-bearing.

const HOSTILE = '<img src="http://evil.invalid/x.png">Mouse'
const hostile = parseDevices([{ id: "h", name: HOSTILE, brand: HOSTILE, level: 5, available: true }])

// Angle brackets never survive, so nothing downstream can sniff a value as markup.
assert.strictEqual(hostile.devices[0].name.indexOf("<"), -1)
assert.strictEqual(hostile.devices[0].name.indexOf(">"), -1)
assert.strictEqual(hostile.devices[0].brand.indexOf("<"), -1)
assert.strictEqual(Model.safeText('<a href="x">y</a>').indexOf("<"), -1)

// The notification card renders body markup, so the body is filtered as well.
assert.strictEqual(Model.notifyBody({ name: HOSTILE, level: 5, kind: "mouse" }).indexOf("<"), -1)

// Newlines cannot forge extra lines in the panel or the notification body.
assert.strictEqual(Model.safeText("Evil\nDevice"), "Evil Device")

// Long fields are capped rather than handed to the shell whole.
assert.strictEqual(Model.safeText("A".repeat(5000)).length, 96)
assert.ok(parseDevices([{ id: "h", name: "A".repeat(5000), level: 5, available: true }])
  .devices[0].name.length <= 96)

// Helper stderr reaches the panel as error text, so it gets the same treatment.
const hostileError = Model.parseStatus(JSON.stringify(
  { ok: false, schema_version: 1, error: "<img src=x>boom\nsecond line" }))
assert.strictEqual(hostileError.ok, false)
assert.strictEqual(hostileError.lastError.indexOf("<"), -1)
assert.strictEqual(hostileError.lastError.indexOf("\n"), -1)

// A name that is nothing but markup falls back to the kind label rather than
// rendering an empty notification.
assert.strictEqual(Model.notifyBody({ name: "<>", level: 5, kind: "headset" }), "Headset \u00b7 5%")
