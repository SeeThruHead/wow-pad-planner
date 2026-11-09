import type { Html, HtmlBuilder } from "foldkit/html"
import { CONTROLLERS } from "../../domain/Controllers.ts"
import type { FaceGlyph } from "../../domain/Controllers.ts"
import { controllerOf, describe, describedLevel, describedName, slotBackIds, usesBack } from "../../domain/Layout.ts"
import type { Described } from "../../domain/Layout.ts"
import { DPAD, FACE, LAYERS, entryAt, sameLocation } from "../../domain/Plan.ts"
import type { Layer, Plan, SlotLocation } from "../../domain/Plan.ts"
import type { Message as AppMessage } from "../app/messages.ts"
import { Message } from "../app/messages.ts"

type H = HtmlBuilder<AppMessage>

const CLUSTERS: Readonly<
  Record<Layer, { readonly dpad: readonly [number, number]; readonly face: readonly [number, number] }>
> = {
  base: { dpad: [380, 240], face: [540, 240] },
  lt: { dpad: [95, 335], face: [245, 335] },
  rt: { dpad: [690, 335], face: [845, 335] },
  both: { dpad: [380, 480], face: [540, 480] }
}
const DPAD_OFFSET: Readonly<Record<string, readonly [number, number]>> = {
  DU: [0, -46],
  DR: [46, 0],
  DD: [0, 46],
  DL: [-46, 0]
}
const FACE_OFFSET: Readonly<Record<string, readonly [number, number]>> = {
  Y: [0, -44],
  B: [44, 0],
  A: [0, 44],
  X: [-44, 0]
}
const ARROWS: Readonly<Record<string, string>> = { DU: "▲", DR: "▶", DD: "▼", DL: "◀" }
const BACK_GRIDS: Readonly<Record<Layer, readonly [number, number]>> = {
  base: [460, 76],
  lt: [170, 196],
  rt: [767, 196],
  both: [460, 338]
}
const BACK_CELL: Readonly<Record<string, readonly [number, number]>> = {
  L4: [-23, 0],
  L5: [-23, 46],
  R4: [23, 0],
  R5: [23, 46],
  P1: [-23, 0],
  P2: [-23, 46],
  P3: [23, 0],
  P4: [23, 46],
  LB4: [-23, 23],
  RB4: [23, 23]
}
const BACK_ROW: Readonly<Record<string, "upper" | "lower">> = {
  L4: "upper",
  R4: "upper",
  P1: "upper",
  P3: "upper",
  L5: "lower",
  R5: "lower",
  P2: "lower",
  P4: "lower",
  LB4: "upper",
  RB4: "upper"
}
const BACK_GLYPH = {
  upper:
    '<svg viewBox="0 0 30 30" width="26" height="26"><rect x="6" y="12" width="18" height="6" rx="3" fill="#cfe0f5"/></svg>',
  lower:
    '<svg viewBox="0 0 30 30" width="26" height="26"><path d="M7 20 Q10 10 23 11" fill="none" stroke="#cfe0f5" stroke-width="5" stroke-linecap="round"/></svg>'
}
export const CLIENT_FACE: Readonly<Record<string, { readonly label: string; readonly svg: string }>> = {
  X: {
    label: "Interact",
    svg: '<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="19" fill="#1c1c1c"/><path d="M13 27 l4-12 l3 7 l3-9 l4 14z" fill="#d9b25a" stroke="#6b4e18" stroke-width="1.5"/></svg>'
  },
  Y: {
    label: "Inspect",
    svg: '<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="19" fill="#0d0d0d"/><circle cx="20" cy="18" r="9" fill="#2b2b2b" stroke="#555"/><circle cx="17" cy="15" r="3" fill="#888"/></svg>'
  },
  B: {
    label: "Back",
    svg: '<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="19" fill="#d4a62a"/><path d="M12 12 L28 28 M28 12 L12 28" stroke="#b3201a" stroke-width="6" stroke-linecap="round"/></svg>'
  },
  A: {
    label: "Jump",
    svg: '<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="19" fill="#e5c22e"/><path d="M20 8 L30 22 H24 V32 H16 V22 H10z" fill="#2b2410"/></svg>'
  }
}
const RING_SVG = (color: string): string =>
  `<svg viewBox="0 0 52 46" width="52" height="46"><path d="M6 4 H40 L48 12 V40 H12 L4 32 V6z" fill="#1d1d1d" stroke="#8a7a5a" stroke-width="2"/><circle cx="26" cy="23" r="10" fill="none" stroke="${color}" stroke-width="3"/><path d="M26 9 V16 M26 30 V37 M12 23 H19 M33 23 H40" stroke="${color}" stroke-width="3"/></svg>`

const facesOf = (plan: Plan): Readonly<Record<string, FaceGlyph>> => controllerOf(plan).face

export const slotId = (location: SlotLocation): string => `slot:${location.kind}:${location.layer}:${location.key}`

const at = (x: number | string, y: number) => ({ left: typeof x === "number" ? `${x}px` : x, top: `${y}px` })

const tipAttributes = (h: H, id: string, label: string) => [
  h.DataAttribute("tip-id", id),
  h.AriaLabel(label),
  h.OnMouseEnter(Message.HoveredTip({ target: id })),
  h.OnMouseLeave(Message.LeftTip())
]

const iconOf = (h: H, described: Described): Html => {
  if (described.kind === "spell" && described.spell.icon)
    return h.img([h.Src(`/icons/${described.spell.icon}.jpg`), h.Alt("")])
  return h.div([h.Class("custom-text")], [describedName(described)])
}

const faceBadge = (h: H, plan: Plan, location: SlotLocation): Html | null => {
  if (location.kind === "paddle") return h.span([h.Class("badge")], [location.key])
  const face = facesOf(plan)[location.key]
  return face ? h.span([h.Class("badge"), h.Style({ color: face.color })], [face.glyph]) : null
}

const emptyGlyph = (h: H, plan: Plan, location: SlotLocation, shape: string): Html => {
  if (location.kind === "paddle") return h.span([h.InnerHTML(BACK_GLYPH[BACK_ROW[location.key] ?? "upper"])], [])
  if (shape === "square")
    return h.span([h.Class("glyph-big"), h.Style({ "font-size": "18px" })], [ARROWS[location.key] ?? ""])
  const face = facesOf(plan)[location.key]
  return h.span([h.Class("glyph-big"), h.Style({ color: face?.color ?? "", opacity: "0.55" })], [face?.glyph ?? ""])
}

export type SlotState = {
  readonly selected: SlotLocation | null
  readonly label: (location: SlotLocation, described: Described | undefined) => string
}

export const slotNode = (
  h: H,
  plan: Plan,
  state: SlotState,
  location: SlotLocation,
  shape: string,
  x: number,
  y: number
): Html => {
  const described = describe(plan, entryAt(plan, location))
  const tooHigh = describedLevel(described) > plan.level
  const classes = [
    "slot",
    shape,
    described?.kind === "custom" ? "custom" : "",
    tooHigh ? "too-high" : "",
    sameLocation(state.selected, location) ? "selected" : ""
  ]
  const level = describedLevel(described)
  return h.div(
    [
      h.Class(classes.filter((name) => name.length > 0).join(" ")),
      h.Style(at(x, y)),
      ...tipAttributes(h, slotId(location), state.label(location, described)),
      h.Draggable(described !== undefined),
      h.OnDragStart(Message.StartedDragSlot({ location })),
      h.OnDragEnd(Message.EndedDrag()),
      h.AllowDrop(),
      h.OnDrop(Message.DroppedOnSlot({ location })),
      h.OnClick(Message.ClickedSlot({ location })),
      h.OnContextMenu(Message.RightClickedSlot({ location }))
    ],
    [
      h.div([h.Class("face")], [described ? iconOf(h, described) : emptyGlyph(h, plan, location, shape)]),
      ...(described ? [faceBadge(h, plan, location)].filter((node): node is Html => node !== null) : []),
      ...(level > 1 ? [h.span([h.Class("lvl")], [String(level)])] : [])
    ]
  )
}

const lockedNode = (h: H, plan: Plan, key: string, x: number, y: number): Html => {
  const face = facesOf(plan)[key]
  const client = CLIENT_FACE[key]
  return h.div(
    [
      h.Class("slot round locked"),
      h.Style(at(x, y)),
      ...tipAttributes(h, `face:${key}`, `${client?.label ?? key} (the game's own)`)
    ],
    [
      h.div([h.Class("face"), h.InnerHTML(client?.svg ?? "")], []),
      h.span([h.Class("badge"), h.Style({ color: face?.color ?? "" })], [face?.glyph ?? ""])
    ]
  )
}

const clusterNodes = (h: H, plan: Plan, state: SlotState, layer: Layer): ReadonlyArray<Html> => {
  const { dpad, face } = CLUSTERS[layer]
  const dpadNodes = DPAD.map((key) => {
    const [dx, dy] = DPAD_OFFSET[key] ?? [0, 0]
    return slotNode(h, plan, state, { kind: "bar", layer, key }, "square", dpad[0] + dx, dpad[1] + dy)
  })
  const faceNodes = FACE.map((key) => {
    const [dx, dy] = FACE_OFFSET[key] ?? [0, 0]
    return layer === "base"
      ? lockedNode(h, plan, key, face[0] + dx, face[1] + dy)
      : slotNode(h, plan, state, { kind: "bar", layer, key }, "round", face[0] + dx, face[1] + dy)
  })
  return [...dpadNodes, ...faceNodes]
}

const backGridNodes = (h: H, plan: Plan, state: SlotState, layer: Layer): ReadonlyArray<Html> => {
  const [x, y] = BACK_GRIDS[layer]
  return slotBackIds(plan).map((key) => {
    const [dx, dy] = BACK_CELL[key] ?? [0, 0]
    return slotNode(h, plan, state, { kind: "paddle", layer, key }, "round back", x + dx, y + dy)
  })
}

const positioned = (
  h: H,
  className: string,
  x: number,
  y: number,
  children: ReadonlyArray<Html | string>,
  extra: ReadonlyArray<ReturnType<H["Class"]>> = []
) => h.div([h.Class(className), h.Style(at(x, y)), ...extra], [...children])

const ring = (h: H, kind: "friendly" | "hostile", x: number) =>
  h.div(
    [
      h.Class("ring"),
      h.Style(at(x, 140)),
      ...tipAttributes(h, `ring:${kind}`, kind === "friendly" ? "Friendly target" : "Enemy target")
    ],
    [h.span([h.InnerHTML(RING_SVG(kind === "friendly" ? "var(--friendly)" : "var(--hostile)"))], [])]
  )

export const Hud = (h: H, plan: Plan, state: SlotState): Html => {
  const names = (CONTROLLERS[plan.controller] ?? CONTROLLERS.xbox).names
  return h.div(
    [h.Class("stage-wrap")],
    [
      h.div(
        [h.Class(usesBack(plan) ? "stage" : "stage no-back"), h.Id("stage")],
        [
          ring(h, "friendly", 300),
          ring(h, "hostile", 640),
          ...LAYERS.flatMap((layer) => clusterNodes(h, plan, state, layer)),
          ...LAYERS.flatMap((layer) => backGridNodes(h, plan, state, layer)),
          positioned(h, "cluster-label", 300, 390, [names.lt]),
          positioned(h, "cluster-label", 640, 390, [names.rt]),
          positioned(h, "cluster-label", 432, 552, [names.lt]),
          positioned(h, "cluster-label plus", 460, 552, ["+"]),
          positioned(h, "cluster-label", 488, 552, [names.rt])
        ]
      )
    ]
  )
}
