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
assert.strictEqual(Model.levelDisplayText(bothKnown.devices[0], "percent"), "75%")
assert.strictEqual(Model.levelDisplayText(bothKnown.devices[1], "percent"), "67%")
const logitech = Model.brandGroups(bothKnown.devices)
assert.strictEqual(logitech.length, 1)
assert.strictEqual(logitech[0].headerShowsLevel, false)
assert.strictEqual(logitech[0].devices[0].level !== logitech[0].devices[1].level, true)
assert.strictEqual(Model.formatRemaining(0), "--")
assert.strictEqual(Model.formatRemaining(90), "2m")
assert.strictEqual(Model.formatRemaining(5400), "1h 30m")
assert.strictEqual(Model.statusLabel("discharging", false), "In use")
assert.deepStrictEqual(Model.displayModes(ok.devices), ["percent", "status"])
assert.strictEqual(Model.nextDisplayMode("percent", ok.devices), "status")
assert.strictEqual(Model.levelDisplayText(ok.devices[0], "percent"), "77%")
assert.strictEqual(Model.levelDisplayText(ok.devices[0], "status"), "In use")

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

console.log("model.test.js ok")
