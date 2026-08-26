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
assert.strictEqual(Model.levelFraction(ok.devices[1].level), 0)
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

const unnamed = Model.parseStatus(JSON.stringify({
  ok: true,
  schema_version: 1,
  devices: [
    { id: "pack:anon", name: "", brand: "", kind: "", level: 42, available: true },
    "not-a-device",
    null
  ]
}))
assert.strictEqual(unnamed.ok, true)
assert.strictEqual(unnamed.devices.length, 1)
assert.strictEqual(unnamed.devices[0].brand, "Other")
assert.strictEqual(unnamed.devices[0].kind, "unknown")
assert.strictEqual(Model.displayName(unnamed.devices[0]), "Device")
assert.strictEqual(Model.deviceBrand(unnamed.devices[0]), "Other")
assert.strictEqual(Model.kindGlyph("unknown"), "󰂂")
assert.strictEqual(Model.levelText(unnamed.devices[0].level), "42%")
const otherGroup = Model.brandGroups(unnamed.devices)
assert.strictEqual(otherGroup.length, 1)
assert.strictEqual(otherGroup[0].brand, "Other")

const razer = Model.parseStatus(JSON.stringify({
  ok: true,
  schema_version: 1,
  devices: [{ id: "r", name: "DeathAdder V3 Pro", brand: "Razer", kind: "unknown", level: 80, available: true }]
}))
assert.strictEqual(Model.displayName(razer.devices[0]), "DeathAdder V3 Pro")
assert.strictEqual(Model.deviceBrand(razer.devices[0]), "Razer")
assert.strictEqual(Model.kindGlyph(razer.devices[0].kind), "󰂂")

console.log("model.test.js ok")
