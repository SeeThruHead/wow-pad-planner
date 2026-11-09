import type { Html, HtmlBuilder } from "foldkit/html"
import type { Spell } from "../../domain/Catalog.ts"
import { lookup } from "../../domain/Catalog.ts"
import { controllerOf, describe, slotTitle } from "../../domain/Layout.ts"
import type { Described } from "../../domain/Layout.ts"
import { entryAt } from "../../domain/Plan.ts"
import type { Layer, Plan, SlotLocation } from "../../domain/Plan.ts"
import type { Message } from "../app/messages.ts"
import type { Tip as Placement } from "../app/model.ts"
import { CLIENT_FACE } from "./Hud.ts"

type H = HtmlBuilder<Message>

export type TipContent = {
  readonly icon?: string
  readonly title: string
  readonly sub?: string
  readonly line?: string
  readonly code?: string
  readonly place?: string
}

const firstSentence = (text: string): string => {
  const clean = text.replace(/\? /g, "some ").replace(/\s+/g, " ").trim()
  const end = clean.search(/\.(\s|$)/)
  return end > 0 ? clean.slice(0, end + 1) : clean
}

export const spellTip = (spell: Spell, place?: string): TipContent => {
  const sub =
    spell.kind === "macro"
      ? "Macro"
      : spell.kind === "item"
        ? "Item"
        : `Learned at level ${spell.level}${spell.talent ? ", talent" : ""}`
  return {
    ...(spell.icon ? { icon: spell.icon } : {}),
    title: spell.name,
    sub,
    line: spell.kind === "macro" ? (spell.about ?? "") : firstSentence(spell.desc),
    ...(spell.kind === "macro" ? { code: spell.desc } : {}),
    ...(place ? { place } : {})
  }
}

const describedTip = (described: Described, place: string): TipContent => {
  if (described.kind === "spell") return spellTip(described.spell, place)
  if (described.kind === "custom") {
    return {
      title: described.name,
      sub: "Custom slot",
      line: described.body ? "Runs this macro text:" : "A reminder; nothing is placed in game.",
      code: described.body,
      place
    }
  }
  return { title: described.name, sub: "Not in this class's spell list", place }
}

const CLIENT_ABOUT: Readonly<Record<string, string>> = {
  X: "Talks to, loots or uses whatever is in front of you.",
  Y: "Inspects your target.",
  B: "Goes back: closes the open window or cancels.",
  A: "Jumps."
}

export const BUTTON_TIPS: Readonly<Record<string, string>> = {
  new: "Start an empty layout for the class and controller you have picked.",
  duplicate: "Make your own copy of this layout to change.",
  delete: "Delete this layout from this browser. Built-in layouts can't be deleted.",
  "use-back":
    "Use your controller's back buttons as extra slots on every trigger layer. Needs the SNRN Backhand addon in WoW.",
  mirror:
    "Copy this set's d-pad spells onto the back buttons, on every layer, so you can cast them without moving your thumb off the stick.",
  "save-wow":
    "A small file holding this layout. Put it in the PadPlan folder, replacing the one there. No typing in game.",
  "addon-code":
    "This layout as one text code. In game: /padplan import, paste, Import. In another planner: Import, paste.",
  import: "Add a layout from a layout code or from an exported file.",
  export: "Save this layout as a file you can keep as a backup or send. WoW doesn't read it; Import brings it back."
}

const BUTTON_TITLES: Readonly<Record<string, string>> = {
  new: "New",
  duplicate: "Duplicate",
  delete: "Delete",
  "use-back": "Back buttons (Backhand addon)",
  mirror: "Copy the d-pad onto the back buttons",
  "save-wow": "Download PadPlanData.lua",
  "addon-code": "Copy layout code",
  import: "Import",
  export: "Export this layout as a file"
}

const parseSlot = (target: string): SlotLocation | null => {
  const [, kind, layer, key] = target.split(":")
  if ((kind !== "bar" && kind !== "paddle") || !layer || !key) return null
  if (layer !== "base" && layer !== "lt" && layer !== "rt" && layer !== "both") return null
  const location: SlotLocation = { kind, layer: layer satisfies Layer, key }
  return location
}

const slotTip = (plan: Plan, target: string): TipContent | null => {
  const location = parseSlot(target)
  if (location === null) return null
  const described = describe(plan, entryAt(plan, location))
  const place = slotTitle(plan, location, undefined).replace(/: empty$/, "")
  if (!described)
    return {
      title: `${place}: empty`,
      sub: "Empty slot",
      line: "Drag a spell here, or tap a spell and then this slot."
    }
  return describedTip(described, place)
}

const faceTip = (plan: Plan, key: string): TipContent => {
  const glyph = Object.entries(controllerOf(plan).face).find(([name]) => name === key)?.[1]
  return {
    title: CLIENT_FACE[key]?.label ?? key,
    sub: `${glyph?.glyph ?? key} with no trigger held, the game's own`,
    line: `${CLIENT_ABOUT[key] ?? ""} Hold a trigger to use this button for spells.`
  }
}

const ringTip = (plan: Plan, kind: string): TipContent => {
  const names = controllerOf(plan).names
  if (kind === "friendly") {
    return {
      title: "Friendly target",
      sub: names.lb,
      line: `Tap ${names.lb} to cycle friendly targets; hold it and use the stick to pick one. ${names.lb} + face buttons act on the target.`
    }
  }
  return {
    title: "Enemy target",
    sub: names.rb,
    line: `Tap ${names.rb} to cycle enemies; hold it and use the stick to pick one.`
  }
}

const spellNameTip = (plan: Plan, name: string): TipContent | null => {
  const spell = lookup(plan.class, name)
  return spell ? spellTip(spell) : null
}

const TIPS: Readonly<Record<string, (plan: Plan, rest: string, target: string) => TipContent | null>> = {
  slot: (plan, _rest, target) => slotTip(plan, target),
  face: (plan, rest) => faceTip(plan, rest),
  ring: (plan, rest) => ringTip(plan, rest),
  spell: (plan, rest) => spellNameTip(plan, rest),
  button: (_plan, rest) => ({ title: BUTTON_TITLES[rest] ?? rest, line: BUTTON_TIPS[rest] ?? "" })
}

export const tipFor = (plan: Plan, target: string): TipContent | null => {
  const split = target.indexOf(":")
  const handler = TIPS[target.slice(0, split)]
  return handler ? handler(plan, target.slice(split + 1), target) : null
}

export const TipView = (h: H, content: TipContent | null, placement: Placement | null): Html =>
  h.div(
    [
      h.Id("tip"),
      h.Role("tooltip"),
      h.Hidden(content === null),
      h.Style(placement ? { left: `${placement.left}px`, top: `${placement.top}px` } : { left: "-9999px", top: "0px" })
    ],
    content === null
      ? []
      : [
          h.div(
            [h.Class("tip-head")],
            [
              ...(content.icon ? [h.img([h.Src(`/icons/${content.icon}.jpg`), h.Alt("")])] : []),
              h.div(
                [],
                [
                  h.div([h.Class("tip-title")], [content.title]),
                  ...(content.sub ? [h.div([h.Class("tip-sub")], [content.sub])] : [])
                ]
              )
            ]
          ),
          ...(content.line ? [h.p([], [content.line])] : []),
          ...(content.code ? [h.pre([], [content.code])] : []),
          ...(content.place ? [h.div([h.Class("tip-place")], [content.place])] : [])
        ]
  )
