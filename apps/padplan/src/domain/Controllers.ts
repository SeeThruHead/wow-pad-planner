import type { ControllerId, FaceKey } from "./Plan.ts"

export type FaceGlyph = { readonly glyph: string; readonly color: string }
export type ButtonNames = {
  readonly lb: string
  readonly rb: string
  readonly lt: string
  readonly rt: string
  readonly ls: string
  readonly rs: string
  readonly view: string
  readonly menu: string
}
export type Controller = {
  readonly name: string
  readonly face: Readonly<Record<FaceKey, FaceGlyph>>
  readonly names: ButtonNames
  readonly back: ReadonlyArray<string>
  readonly pads: ReadonlyArray<string>
  readonly gyro: boolean
  readonly steamInput: boolean
}

const XBOX_FACE: Controller["face"] = {
  A: { glyph: "A", color: "#5dc04b" },
  B: { glyph: "B", color: "#e5463b" },
  X: { glyph: "X", color: "#3f8fe0" },
  Y: { glyph: "Y", color: "#e8c330" }
}

const PLAYSTATION_FACE: Controller["face"] = {
  A: { glyph: "✕", color: "#7aa7ff" },
  B: { glyph: "○", color: "#ff6b6b" },
  X: { glyph: "□", color: "#f39bd3" },
  Y: { glyph: "△", color: "#5fd6a8" }
}

const XBOX_NAMES: ButtonNames = {
  lb: "LB",
  rb: "RB",
  lt: "LT",
  rt: "RT",
  ls: "L3",
  rs: "R3",
  view: "View",
  menu: "Menu"
}
const PLAYSTATION_NAMES: ButtonNames = {
  lb: "L1",
  rb: "R1",
  lt: "L2",
  rt: "R2",
  ls: "L3",
  rs: "R3",
  view: "Create",
  menu: "Options"
}

export const CONTROLLERS: Readonly<Record<ControllerId, Controller>> = {
  xbox: {
    name: "Xbox controller",
    face: XBOX_FACE,
    names: XBOX_NAMES,
    back: [],
    pads: [],
    gyro: false,
    steamInput: false
  },
  elite: {
    name: "Xbox Elite Series 2",
    face: XBOX_FACE,
    names: XBOX_NAMES,
    back: ["P1", "P2", "P3", "P4"],
    pads: [],
    gyro: false,
    steamInput: true
  },
  dualsense: {
    name: "DualSense",
    face: PLAYSTATION_FACE,
    names: PLAYSTATION_NAMES,
    back: [],
    pads: ["Touchpad"],
    gyro: true,
    steamInput: true
  },
  edge: {
    name: "DualSense Edge",
    face: PLAYSTATION_FACE,
    names: PLAYSTATION_NAMES,
    back: ["LB4", "RB4"],
    pads: ["Touchpad"],
    gyro: true,
    steamInput: true
  },
  steam: {
    name: "Steam Controller",
    face: XBOX_FACE,
    names: XBOX_NAMES,
    back: ["L4", "L5", "R4", "R5"],
    pads: ["Left trackpad", "Right trackpad"],
    gyro: true,
    steamInput: true
  },
  deck: {
    name: "Steam Deck",
    face: XBOX_FACE,
    names: XBOX_NAMES,
    back: ["L4", "L5", "R4", "R5"],
    pads: ["Left trackpad", "Right trackpad"],
    gyro: true,
    steamInput: true
  }
}

export const BACK_LABELS: Readonly<Record<string, string>> = {
  P1: "P1 (upper left)",
  P2: "P2 (lower left)",
  P3: "P3 (upper right)",
  P4: "P4 (lower right)",
  LB4: "Left back",
  RB4: "Right back"
}

export const FREE_KEYS: ReadonlyArray<string> = ["F9", "F10", "F11", "F12", "F6", "F7", "F8"]

export const KEY_NOTES: Readonly<Record<string, string>> = {
  F8: "bag key in WoW, PadPlan frees it",
  F9: "bag key in WoW, PadPlan frees it",
  F10: "bag key in WoW, PadPlan frees it",
  F11: "bag key in WoW, PadPlan frees it",
  F12: "bag key in WoW, PadPlan frees it"
}

export const backLabel = (id: string): string => BACK_LABELS[id] ?? id
