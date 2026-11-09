import { classCatalog, lookup } from "./Catalog.ts"
import type { Spell } from "./Catalog.ts"
import { Schema } from "effect"
import { CONTROLLERS, FREE_KEYS, KEY_NOTES, backLabel } from "./Controllers.ts"
import type { Controller } from "./Controllers.ts"
import { DPAD, FaceKey, LAYERS, emptyLayers } from "./Plan.ts"
import type { BackSetting, ClassId, ControllerId, Entry, Layer, Plan, SlotLocation } from "./Plan.ts"

const PAGE_UNIT_BUTTON: Readonly<Record<string, number>> = { DL: 1, DU: 2, DR: 3, DD: 4, X: 5, Y: 6, B: 7, A: 8 }

export const DPAD_NAMES: Readonly<Record<string, string>> = {
  DU: "D-pad up",
  DR: "D-pad right",
  DD: "D-pad down",
  DL: "D-pad left"
}

export const controllerOf = (plan: Plan): Controller => CONTROLLERS[plan.controller]

export const layerName = (plan: Plan, layer: Layer): string => {
  const names = controllerOf(plan).names
  return { base: "No trigger", lt: names.lt, rt: names.rt, both: `${names.lt} + ${names.rt}` }[layer]
}

const isFaceKey = Schema.is(FaceKey)

export const buttonName = (plan: Plan, key: string): string => {
  if (isFaceKey(key)) return controllerOf(plan).face[key].glyph
  return DPAD_NAMES[key] ?? key
}

export type Described =
  | { readonly kind: "spell"; readonly spell: Spell }
  | { readonly kind: "custom"; readonly name: string; readonly body: string }
  | { readonly kind: "missing"; readonly name: string }

export const describe = (plan: Plan, entry: Entry | undefined): Described | undefined => {
  if (!entry) return undefined
  if ("custom" in entry) return { kind: "custom", name: entry.custom.label || "Custom", body: entry.custom.body }
  const spell = lookup(plan.class, entry.ref)
  return spell ? { kind: "spell", spell } : { kind: "missing", name: entry.ref }
}

export const describedName = (described: Described): string =>
  described.kind === "spell" ? described.spell.name : described.name

export const describedLevel = (described: Described | undefined): number =>
  described?.kind === "spell" ? described.spell.level : 0

export const usesBack = (plan: Plan): boolean => Boolean(plan.useBackButtons) && controllerOf(plan).back.length > 0

const backSetting = (plan: Plan, id: string): BackSetting => plan.back[id] ?? { use: "slot", key: "F9", note: "" }

export const slotBackIds = (plan: Plan): ReadonlyArray<string> =>
  usesBack(plan) ? controllerOf(plan).back.filter((id) => backSetting(plan, id).use !== "other") : []

export const backKeys = (plan: Plan): ReadonlyArray<string> => slotBackIds(plan).map((id) => plan.back[id]?.key ?? "")

export const normalizeKey = (text: string): string =>
  text
    .trim()
    .toUpperCase()
    .split(/\s*\+\s*/)
    .map((part) => part.replace(/\s+/g, ""))
    .join("-")

export const otherKeys = (plan: Plan): ReadonlyArray<string> =>
  (plan.otherKeys ?? []).map(normalizeKey).filter((key) => key.length > 0)

export const defaultBack = (controller: ControllerId): Plan["back"] =>
  Object.fromEntries(
    CONTROLLERS[controller].back.map((id, index) => [
      id,
      { use: "slot" as const, key: FREE_KEYS[index] ?? "", note: "" }
    ])
  )

export const emptyPlan = (className: ClassId, controller: ControllerId): Plan => ({
  version: 2,
  name: `${classCatalog(className).name}: empty`,
  class: className,
  controller,
  level: 60,
  activeSet: 0,
  why: "",
  sets: [
    { name: "Combat", layers: emptyLayers() },
    { name: "Out of combat", layers: emptyLayers() },
    { name: "Spare", layers: emptyLayers() }
  ],
  paddles: emptyLayers(),
  back: defaultBack(controller),
  controls: {}
})

export const withController = (plan: Plan, controller: ControllerId): Plan => ({
  ...plan,
  controller,
  back: {
    ...defaultBack(controller),
    ...Object.fromEntries(Object.entries(plan.back).filter(([id]) => CONTROLLERS[controller].back.includes(id)))
  }
})

export const slotTitle = (plan: Plan, location: SlotLocation, described: Described | undefined): string => {
  const place =
    location.kind === "paddle"
      ? `${layerName(plan, location.layer)} + ${location.key}`
      : `${layerName(plan, location.layer)} + ${buttonName(plan, location.key)}`
  return described ? `${place}: ${describedName(described)}` : `${place}: empty`
}

export const slotInfoText = (plan: Plan, location: SlotLocation): string => {
  if (location.kind === "paddle") {
    const key = plan.back[location.key]?.key
    return `${location.key}${key ? ` sends ${key}` : ""}: Backhand paddle ${slotBackIds(plan).indexOf(location.key) + 1} on the ${layerName(plan, location.layer)} layer (same in every set).`
  }
  const bar = { base: 0, lt: 1, rt: 2, both: 3 }[location.layer]
  const button = PAGE_UNIT_BUTTON[location.key] ?? 0
  return `Set ${plan.activeSet + 1}, gamepad bar slot ${bar * 8 + button} of 32.`
}

export const mirrorDpad = (plan: Plan): Plan => {
  const slots = slotBackIds(plan)
  const layers = (plan.sets[plan.activeSet] ?? plan.sets[0]).layers
  const mirrored = (layer: Layer) =>
    Object.fromEntries(
      slots.flatMap((id, index) => {
        const entry = layers[layer][DPAD[index] ?? ""]
        return entry ? [[id, entry]] : []
      })
    )
  return {
    ...plan,
    paddles: { base: mirrored("base"), lt: mirrored("lt"), rt: mirrored("rt"), both: mirrored("both") }
  }
}

export const unpickableKeys = (plan: Plan): ReadonlyArray<readonly [string, string]> =>
  controllerOf(plan).back.flatMap((id) => {
    const key = plan.back[id]?.key
    return key && !FREE_KEYS.includes(key) ? [[id, key] as const] : []
  })

export const fixKeys = (plan: Plan): Plan => {
  const used = controllerOf(plan)
    .back.map((id) => plan.back[id]?.key ?? "")
    .filter((key) => FREE_KEYS.includes(key))
  const spare = FREE_KEYS.filter((key) => !used.includes(key))
  const replacements = new Map(unpickableKeys(plan).map(([id, from], index) => [id, { from, to: spare[index] ?? "" }]))
  const back = Object.fromEntries(
    Object.entries(plan.back).map(([id, setting]) => {
      const replacement = replacements.get(id)
      return [id, replacement ? { ...setting, key: replacement.to } : setting]
    })
  )
  const why = [...replacements.values()].reduce((text, { from, to }) => text.split(from).join(to), plan.why)
  return { ...plan, back, why }
}

export const usedCounts = (plan: Plan): ReadonlyMap<string, number> => {
  const refs = [
    ...plan.sets.flatMap((set) => LAYERS.flatMap((layer) => Object.values(set.layers[layer]))),
    ...LAYERS.flatMap((layer) => Object.values(plan.paddles[layer]))
  ].flatMap((entry) => ("ref" in entry ? [entry.ref] : []))
  return new Map([...Map.groupBy(refs, (ref) => ref)].map(([ref, uses]) => [ref, uses.length]))
}

export const keyClashes = (plan: Plan): ReadonlyArray<string> => {
  const sent = controllerOf(plan).back.flatMap((id) => {
    const key = plan.back[id]?.key
    return key ? [[id, key] as const] : []
  })
  return sent
    .filter(([id, key]) => sent.some(([other, otherKey]) => other !== id && otherKey === key))
    .map(([id, key]) => `${id} and another back button both send ${key}.`)
}

export const backNeeds = (plan: Plan): ReadonlyArray<string> => {
  const keys = slotBackIds(plan).map((id) => `${backLabel(id)} sends ${plan.back[id]?.key || "a spare key"}`)
  return [
    "Install two addons: PadPlan and SNRN Backhand.",
    `In Steam's controller settings for WoW, bind each back button to a keyboard key: ${keys.join(", ") || "mark at least one back button as a spell slot"}.`,
    "Get this layout into the addon: Download PadPlanData.lua into the PadPlan folder, or Copy layout code and paste it with /padplan import.",
    "Log in or reload. PadPlan places the layout by itself and tells Backhand which key each back button sends; nothing to type."
  ]
}

export const steamSteps = (plan: Plan): ReadonlyArray<string> => {
  const controller = controllerOf(plan)
  const names = controller.names
  const slots = slotBackIds(plan)
  if (!controller.steamInput) {
    return [
      `${controller.name}: nothing to set in Steam. The game reads it directly; leave Steam Input off or on its default gamepad layout.`
    ]
  }
  const backSteps = (usesBack(plan) ? controller.back : []).map((id) => {
    const setting = backSetting(plan, id)
    if (setting.use === "other") {
      return `${backLabel(id)}: not a spell slot, ${setting.note || "used by something else"}${setting.key ? ` (sends ${setting.key})` : ""}.`
    }
    const note = KEY_NOTES[setting.key]
    return `${backLabel(id)}: keyboard ${setting.key || "(pick a key above)"}${note ? ` (a ${note})` : ""}.`
  })
  const padSteps = controller.pads.map((pad, index) => {
    const setting = plan.controls[`PAD${index}`] ?? {}
    if (setting.other) return `${pad}: leave it to ${setting.note || "the other tool"}.`
    if (index === controller.pads.length - 1) {
      return `${pad}: mouse (trackpad mode), click is left mouse. Add a mode shift on ${names.lt} so a click while holding ${names.lt} is right mouse.`
    }
    return `${pad}: unbound.`
  })
  const gyro = plan.controls["GYRO"] ?? {}
  const gyroSteps = controller.gyro
    ? [
        gyro.other
          ? `Gyro: leave it to ${gyro.note || "the other tool"}.`
          : `Gyro (optional): gyro to mouse, toggled with ${names.rs}.`
      ]
    : []
  const backhand = slots.length
    ? [
        `In game, with SNRN Backhand and PadPlan installed, PadPlan tells Backhand these keys at login (${slots.map((id, index) => `${id} = Backhand P${index + 1}`).join(", ")}); nothing to set by hand.`
      ]
    : []
  const others = otherKeys(plan)
  return [
    `In Steam (game mode or Big Picture), add Battle.net as a non-Steam game, start WoW from it, then open its controller settings. Start from the "Gamepad with Mouse Trackpad" template (or "Gamepad" for a controller without a touchpad).`,
    ...backSteps,
    ...padSteps,
    ...gyroSteps,
    ...backhand,
    ...keyClashes(plan).map((text) => `Clash: ${text}`),
    ...(others.length
      ? [
          `Keys other tools send (${others.join(", ")}): PadPlan clears any WoW binding on them and keeps WoW from acting on them.`
        ]
      : [])
  ]
}

export type ControlRow = {
  readonly key: string
  readonly name: string
  readonly fixed: string
  readonly editable: boolean
}

export const controlRows = (plan: Plan): ReadonlyArray<ControlRow> => {
  const controller = controllerOf(plan)
  const names = controller.names
  const slots = slotBackIds(plan)
  const backs = (usesBack(plan) ? controller.back : []).map((id) => {
    const setting = backSetting(plan, id)
    const fixed =
      setting.use === "other"
        ? `Used by something else${setting.note ? `: ${setting.note}` : ""}${setting.key ? ` (sends ${setting.key})` : ""}. No spell.`
        : `Spell slots: Steam Input sends ${setting.key || "a free key"}, Backhand paddle ${slots.indexOf(id) + 1}.`
    return { key: id, name: backLabel(id), fixed, editable: false }
  })
  const pads = controller.pads.map((pad, index) => ({
    key: `PAD${index}`,
    name: pad,
    fixed:
      index === controller.pads.length - 1
        ? "Suggested: mouse, click is left mouse; hold a trigger while clicking for right mouse."
        : "Free. Leave unbound or give it your own use.",
    editable: true
  }))
  return [
    { key: "LS", name: "Left stick", fixed: `Move. Click (${names.ls}): not bound by the game.`, editable: true },
    {
      key: "RS",
      name: "Right stick",
      fixed: `Camera. ${names.lb} + ${names.rb} + forward/back zooms. Click (${names.rs}): not bound by the game.`,
      editable: true
    },
    {
      key: "LB",
      name: names.lb,
      fixed: `Target friendly. Hold + stick to pick; ${names.lb} + face buttons: target actions.`,
      editable: false
    },
    { key: "RB", name: names.rb, fixed: "Target hostile. Hold + stick to pick.", editable: false },
    {
      key: "LBRB",
      name: `${names.lb} + ${names.rb}`,
      fixed: "Hold: d-pad left/right switches bar set; B bags, d-pad up quests, d-pad down chat, Y buffs.",
      editable: false
    },
    { key: "LT", name: names.lt, fixed: `Hold: the ${names.lt} bar (left cluster).`, editable: false },
    {
      key: "RT",
      name: names.rt,
      fixed: `Hold: the ${names.rt} bar (right cluster). Both triggers: bottom cluster.`,
      editable: false
    },
    {
      key: "FACE",
      name: "Face buttons",
      fixed: "No trigger: interact, inspect, back, jump. With a trigger: spell slots.",
      editable: false
    },
    { key: "DPAD", name: "D-pad", fixed: "Spell slots on every layer.", editable: false },
    ...backs,
    ...pads,
    ...(controller.gyro
      ? [{ key: "GYRO", name: "Gyro", fixed: "Optional: gyro to mouse, toggled with a stick click.", editable: true }]
      : []),
    { key: "VIEW", name: names.view, fixed: "Change focus frame.", editable: false },
    { key: "MENU", name: names.menu, fixed: "Main menu (radial).", editable: false }
  ]
}
