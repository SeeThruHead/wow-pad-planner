import { Effect, Schema } from "effect"
import { DPAD, FACE, LAYERS, Plan } from "./Plan.ts"
import type { Entry, Layer, Slots } from "./Plan.ts"
import { backKeys, describe, otherKeys, slotBackIds } from "./Layout.ts"

export const ADDON_PREFIX = "PADPLAN1:"
export const SHARE_PREFIX = "WPP1:"

const macroName = (label: string): string => `PP ${label}`.slice(0, 16)
const luaString = (text: string): string =>
  `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`

type Placed =
  | { readonly kind: "spell"; readonly id: number | null; readonly names: ReadonlyArray<string> }
  | { readonly kind: "macro"; readonly name: string; readonly icon: string; readonly body: string }
  | { readonly kind: "item"; readonly id: number | null; readonly name: string }

const placedOf = (plan: Plan, entry: Entry | undefined): Placed | undefined => {
  const described = describe(plan, entry)
  if (!described || described.kind === "missing") return undefined
  if (described.kind === "custom") {
    return described.body.trim()
      ? { kind: "macro", name: macroName(described.name), icon: "INV_MISC_QUESTIONMARK", body: described.body }
      : undefined
  }
  const spell = described.spell
  if (spell.kind === "macro")
    return { kind: "macro", name: macroName(spell.name), icon: spell.icon ?? "", body: spell.desc }
  if (spell.kind === "item") return { kind: "item", id: spell.id, name: spell.name }
  return { kind: "spell", id: spell.id, names: [spell.name, ...spell.aliases] }
}

const luaEntry = (placed: Placed): string => {
  if (placed.kind === "macro") {
    return `{ kind = "macro", name = ${luaString(placed.name)}, icon = ${luaString(placed.icon)}, body = ${luaString(placed.body)} }`
  }
  if (placed.kind === "item") return `{ kind = "item", id = ${placed.id}, name = ${luaString(placed.name)} }`
  return `{ kind = "spell", id = ${placed.id}, names = { ${placed.names.map(luaString).join(", ")} } }`
}

const keysFor = (layer: Layer): ReadonlyArray<string> => (layer === "base" ? DPAD : [...DPAD, ...FACE])

const placedRows = (plan: Plan, slots: Slots, keys: ReadonlyArray<string>) =>
  keys.flatMap((key) => {
    const placed = placedOf(plan, slots[key])
    return placed ? [[key, placed] as const] : []
  })

const luaLayer = (plan: Plan, slots: Slots, keys: ReadonlyArray<string>, indent: string): string => {
  const lines = placedRows(plan, slots, keys).map(([key, placed]) => `${indent}  ${key} = ${luaEntry(placed)},`)
  return lines.length ? `{\n${lines.join("\n")}\n${indent}}` : "{}"
}

export const toLua = (plan: Plan): string => {
  const slots = slotBackIds(plan)
  const sets = plan.sets
    .map((set) => {
      const layers = LAYERS.map(
        (layer) => `        ${layer} = ${luaLayer(plan, set.layers[layer], keysFor(layer), "        ")},`
      ).join("\n")
      return `    {\n      name = ${luaString(set.name)},\n      layers = {\n${layers}\n      },\n    },`
    })
    .join("\n")
  const paddles = LAYERS.map((layer) => `    ${layer} = ${luaLayer(plan, plan.paddles[layer], slots, "    ")},`).join(
    "\n"
  )
  return `-- ${plan.name}, from the gamepad bar planner.\nPadPlanData = {\n  version = 1,\n  name = ${luaString(plan.name)},\n  class = ${luaString(plan.class)},\n  paddleOrder = { ${slots.map(luaString).join(", ")} },\n  paddleKeys = { ${backKeys(plan).map(luaString).join(", ")} },\n  reservedKeys = { ${otherKeys(plan).map(luaString).join(", ")} },\n  sets = {\n${sets}\n  },\n  paddles = {\n${paddles}\n  },\n}\n`
}

const addonText = (text: string): string => text.replace(/[\t\n]/g, " ")
const addonEscape = (text: string): string => text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\t/g, "\\t")

const addonFields = (placed: Placed): ReadonlyArray<string> => {
  if (placed.kind === "macro") return ["macro", addonText(placed.name), placed.icon, addonEscape(placed.body)]
  if (placed.kind === "item") return ["item", String(placed.id), placed.name]
  return ["spell", String(placed.id), placed.names.join("|")]
}

const addonRows = (plan: Plan, slots: Slots, keys: ReadonlyArray<string>, prefix: ReadonlyArray<string>) =>
  placedRows(plan, slots, keys).map(([key, placed]) => [...prefix, key, ...addonFields(placed)])

export const addonLines = (plan: Plan): string => {
  const slots = slotBackIds(plan)
  const bars = plan.sets.flatMap((set, index) => [
    ["set", String(index + 1), addonText(set.name)],
    ...LAYERS.flatMap((layer) => addonRows(plan, set.layers[layer], keysFor(layer), ["b", String(index + 1), layer]))
  ])
  const paddles = LAYERS.flatMap((layer) => addonRows(plan, plan.paddles[layer], slots, ["p", layer]))
  return [
    ["PADPLAN", "1"],
    ["name", addonText(plan.name)],
    ["class", plan.class],
    ["order", slots.join(",")],
    ["keys", backKeys(plan).join(",")],
    ["reserved", otherKeys(plan).join(",")],
    ...bars,
    ...paddles,
    ["plan", JSON.stringify({ ...plan, activeSet: 0 })]
  ]
    .map((fields) => fields.join("\t"))
    .join("\n")
}

const toBase64 = (bytes: Uint8Array): string => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (character) => character.charCodeAt(0))

export const addonCode = (plan: Plan): string => ADDON_PREFIX + toBase64(new TextEncoder().encode(addonLines(plan)))

export class CodeError extends Schema.TaggedError<CodeError, { readonly brand: unique symbol }>()("CodeError", {
  message: Schema.String
}) {}

const notACode = new CodeError({ message: "That isn't a layout from this planner." })

const inflate = (bytes: Uint8Array) =>
  Effect.tryPromise({
    try: () =>
      new Response(
        new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream("deflate-raw"))
      ).text(),
    catch: () => notACode
  })

const fromBase64Url = (text: string): Uint8Array => fromBase64(text.replace(/-/g, "+").replace(/_/g, "/"))

const planLine = (text: string) => {
  const line = text.split("\n").find((row) => row.startsWith("plan\t"))
  return line ? Effect.succeed(line.slice(5)) : Effect.fail(notACode)
}

const jsonOf = (text: string) => {
  const trimmed = text.trim()
  if (trimmed.startsWith("{")) return Effect.succeed(trimmed)
  if (trimmed.startsWith(ADDON_PREFIX)) {
    return Effect.try({
      try: () => new TextDecoder().decode(fromBase64(trimmed.slice(ADDON_PREFIX.length).replace(/\s+/g, ""))),
      catch: () => notACode
    }).pipe(Effect.flatMap(planLine))
  }
  if (trimmed.startsWith(SHARE_PREFIX)) {
    return Effect.try({ try: () => fromBase64Url(trimmed.slice(SHARE_PREFIX.length)), catch: () => notACode }).pipe(
      Effect.flatMap(inflate)
    )
  }
  return Effect.fail(notACode)
}

export const readCode = Effect.fn("Exports.readCode")(function* (text: string) {
  const json = yield* jsonOf(text)
  return yield* Schema.decodeEffect(Schema.fromJsonString(Plan))(json).pipe(Effect.mapError(() => notACode))
})
