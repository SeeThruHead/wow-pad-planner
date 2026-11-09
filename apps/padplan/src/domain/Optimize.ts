import { describe, describedName, layerName, slotBackIds } from "./Layout.ts"
import { DPAD, LAYERS } from "./Plan.ts"
import type { Entry, Layer, Layers, Plan } from "./Plan.ts"

export type Move = { readonly name: string; readonly from: string; readonly to: string }
export type Rearranged = { readonly plan: Plan; readonly moves: ReadonlyArray<Move> }

type Place = { readonly set: number | "paddle"; readonly layer: Layer; readonly key: string }

const MOST_PRESSED_FACES: ReadonlyArray<readonly [Layer, string]> = [
  ["rt", "X"],
  ["rt", "Y"],
  ["rt", "A"],
  ["lt", "X"],
  ["lt", "Y"],
  ["lt", "A"],
  ["both", "X"],
  ["both", "Y"],
  ["both", "A"]
]
const BACK_LAYER_ORDER: ReadonlyArray<Layer> = ["base", "rt", "lt", "both"]
const TRIGGER_FACES: ReadonlyArray<readonly [Layer, string]> = [
  ["rt", "X"],
  ["rt", "Y"],
  ["rt", "A"],
  ["rt", "B"],
  ["lt", "X"],
  ["lt", "Y"],
  ["lt", "A"],
  ["lt", "B"],
  ["both", "X"],
  ["both", "Y"],
  ["both", "A"],
  ["both", "B"]
]

const layersOf = (plan: Plan, place: Place): Layers =>
  place.set === "paddle" ? plan.paddles : (plan.sets[place.set] ?? plan.sets[0]).layers

const read = (plan: Plan, place: Place): Entry | undefined => layersOf(plan, place)[place.layer][place.key]

const writeLayers = (layers: Layers, layer: Layer, key: string, entry: Entry | undefined): Layers => ({
  ...layers,
  [layer]: entry
    ? { ...layers[layer], [key]: entry }
    : Object.fromEntries(Object.entries(layers[layer]).filter(([name]) => name !== key))
})

const write = (plan: Plan, place: Place, entry: Entry | undefined): Plan => {
  if (place.set === "paddle") return { ...plan, paddles: writeLayers(plan.paddles, place.layer, place.key, entry) }
  const index = place.set
  const sets = plan.sets.map((set, position) =>
    position === index ? { ...set, layers: writeLayers(set.layers, place.layer, place.key, entry) } : set
  )
  return { ...plan, sets: [sets[0] ?? plan.sets[0], sets[1] ?? plan.sets[1], sets[2] ?? plan.sets[2]] }
}

const label = (plan: Plan, place: Place): string => {
  const where = `${layerName(plan, place.layer)} + ${place.key}`
  return place.set === "paddle" ? where : `${where} (set ${place.set + 1})`
}

const move = (state: Rearranged, from: Place, to: Place): Rearranged => {
  const entry = read(state.plan, from)
  if (!entry) return state
  const described = describe(state.plan, entry)
  const name = described ? describedName(described) : "slot"
  const plan = write(write(state.plan, from, undefined), to, entry)
  return { plan, moves: [...state.moves, { name, from: label(state.plan, from), to: label(state.plan, to) }] }
}

export const optimizeForBack = (plan: Plan): Rearranged => {
  const emptyBack = BACK_LAYER_ORDER.flatMap((layer) =>
    slotBackIds(plan)
      .filter((key) => !plan.paddles[layer][key])
      .map((key): Place => ({ set: "paddle", layer, key }))
  )
  const sources = MOST_PRESSED_FACES.map(([layer, key]): Place => ({ set: 0, layer, key })).filter((place) =>
    read(plan, place)
  )
  return sources.slice(0, emptyBack.length).reduce<Rearranged>(
    (state, from, index) => {
      const to = emptyBack[index]
      return to ? move(state, from, to) : state
    },
    { plan, moves: [] }
  )
}

const freePlaces = (plan: Plan): ReadonlyArray<Place> => {
  const set1Faces = TRIGGER_FACES.map(([layer, key]): Place => ({ set: 0, layer, key }))
  const set2Faces = TRIGGER_FACES.map(([layer, key]): Place => ({ set: 1, layer, key }))
  const set2Dpad = LAYERS.flatMap((layer) => DPAD.map((key): Place => ({ set: 1, layer, key })))
  const set3 = [
    ...TRIGGER_FACES.map(([layer, key]): Place => ({ set: 2, layer, key })),
    ...LAYERS.flatMap((layer) => DPAD.map((key): Place => ({ set: 2, layer, key })))
  ]
  return [...set1Faces, ...set2Faces, ...set2Dpad, ...set3].filter((place) => !read(plan, place))
}

export const foldBackIntoSlots = (plan: Plan): Rearranged => {
  const sources = LAYERS.flatMap((layer) =>
    Object.keys(plan.paddles[layer]).map((key): Place => ({ set: "paddle", layer, key }))
  )
  const free = freePlaces(plan)
  return sources.slice(0, free.length).reduce<Rearranged>(
    (state, from, index) => {
      const to = free[index]
      return to ? move(state, from, to) : state
    },
    { plan, moves: [] }
  )
}

export const hasBackSpells = (plan: Plan): boolean =>
  LAYERS.some((layer) => Object.keys(plan.paddles[layer]).length > 0)
