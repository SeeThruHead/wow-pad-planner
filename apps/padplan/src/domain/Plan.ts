import { Schema } from "effect"

export const Layer = Schema.Literals(["base", "lt", "rt", "both"])
export type Layer = typeof Layer.Type

export const LAYERS: ReadonlyArray<Layer> = ["base", "lt", "rt", "both"]

export const DpadKey = Schema.Literals(["DU", "DR", "DD", "DL"])
export type DpadKey = typeof DpadKey.Type

export const FaceKey = Schema.Literals(["Y", "B", "A", "X"])
export type FaceKey = typeof FaceKey.Type

export const DPAD: ReadonlyArray<DpadKey> = ["DU", "DR", "DD", "DL"]
export const FACE: ReadonlyArray<FaceKey> = ["Y", "B", "A", "X"]

export const BarKey = Schema.Union([DpadKey, FaceKey])
export type BarKey = typeof BarKey.Type

export const SpellRef = Schema.Struct({ ref: Schema.String })
export const CustomSlot = Schema.Struct({ custom: Schema.Struct({ label: Schema.String, body: Schema.String }) })
export const Entry = Schema.Union([SpellRef, CustomSlot])
export type Entry = typeof Entry.Type

export const Slots = Schema.Record(Schema.String, Entry)
export type Slots = typeof Slots.Type

export const Layers = Schema.Struct({ base: Slots, lt: Slots, rt: Slots, both: Slots })
export type Layers = typeof Layers.Type

export const BarSet = Schema.Struct({ name: Schema.String, layers: Layers })
export type BarSet = typeof BarSet.Type

export const BackUse = Schema.Literals(["slot", "other"])
export const BackSetting = Schema.Struct({ use: BackUse, key: Schema.String, note: Schema.String })
export type BackSetting = typeof BackSetting.Type

export const ControlSetting = Schema.Struct({
  other: Schema.optionalKey(Schema.Boolean),
  note: Schema.optionalKey(Schema.String)
})
export type ControlSetting = typeof ControlSetting.Type

export const ControllerId = Schema.Literals(["xbox", "elite", "dualsense", "edge", "steam", "deck"])
export type ControllerId = typeof ControllerId.Type

export const ClassId = Schema.Literals([
  "WARRIOR",
  "PALADIN",
  "HUNTER",
  "ROGUE",
  "PRIEST",
  "SHAMAN",
  "MAGE",
  "WARLOCK",
  "DRUID"
])
export type ClassId = typeof ClassId.Type

export const Plan = Schema.Struct({
  version: Schema.Literal(2),
  name: Schema.String,
  class: ClassId,
  controller: ControllerId,
  level: Schema.Int,
  activeSet: Schema.Int,
  why: Schema.String,
  sets: Schema.Tuple([BarSet, BarSet, BarSet]),
  paddles: Layers,
  back: Schema.Record(Schema.String, BackSetting),
  controls: Schema.Record(Schema.String, ControlSetting),
  useBackButtons: Schema.optionalKey(Schema.Boolean),
  otherKeys: Schema.optionalKey(Schema.Array(Schema.String))
})
export type Plan = typeof Plan.Type

export const SlotLocation = Schema.Struct({
  kind: Schema.Literals(["bar", "paddle"]),
  layer: Layer,
  key: Schema.String
})
export type SlotLocation = typeof SlotLocation.Type

export const emptyLayers = (): Layers => ({ base: {}, lt: {}, rt: {}, both: {} })

const holderOf = (plan: Plan, location: SlotLocation): Layers =>
  location.kind === "paddle" ? plan.paddles : (plan.sets[plan.activeSet] ?? plan.sets[0]).layers

export const entryAt = (plan: Plan, location: SlotLocation): Entry | undefined =>
  holderOf(plan, location)[location.layer][location.key]

const withoutKey = (slots: Slots, key: string): Slots =>
  Object.fromEntries(Object.entries(slots).filter(([name]) => name !== key))

const placed = (layers: Layers, location: SlotLocation, entry: Entry | undefined): Layers => ({
  ...layers,
  [location.layer]: entry
    ? { ...layers[location.layer], [location.key]: entry }
    : withoutKey(layers[location.layer], location.key)
})

export const withEntry = (plan: Plan, location: SlotLocation, entry: Entry | undefined): Plan => {
  if (location.kind === "paddle") return { ...plan, paddles: placed(plan.paddles, location, entry) }
  const sets = plan.sets.map((set, index) =>
    index === plan.activeSet ? { ...set, layers: placed(set.layers, location, entry) } : set
  )
  return { ...plan, sets: [sets[0] ?? plan.sets[0], sets[1] ?? plan.sets[1], sets[2] ?? plan.sets[2]] }
}

export const swap = (plan: Plan, from: SlotLocation, to: SlotLocation): Plan =>
  withEntry(withEntry(plan, to, entryAt(plan, from)), from, entryAt(plan, to))

export const sameLocation = (a: SlotLocation | null, b: SlotLocation | null): boolean =>
  a !== null && b !== null && a.kind === b.kind && a.layer === b.layer && a.key === b.key

export const decodePlan = Schema.decodeUnknownEffect(Plan)
export const isPlan = Schema.is(Plan)
