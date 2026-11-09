"use strict";

const XBOX_FACE = {
  A: { glyph: "A", color: "#5dc04b" },
  B: { glyph: "B", color: "#e5463b" },
  X: { glyph: "X", color: "#3f8fe0" },
  Y: { glyph: "Y", color: "#e8c330" },
};

const PLAYSTATION_FACE = {
  A: { glyph: "✕", color: "#7aa7ff" },
  B: { glyph: "○", color: "#ff6b6b" },
  X: { glyph: "□", color: "#f39bd3" },
  Y: { glyph: "△", color: "#5fd6a8" },
};

const XBOX_NAMES = { lb: "LB", rb: "RB", lt: "LT", rt: "RT", ls: "L3", rs: "R3", view: "View", menu: "Menu" };
const PLAYSTATION_NAMES = { lb: "L1", rb: "R1", lt: "L2", rt: "R2", ls: "L3", rs: "R3", view: "Create", menu: "Options" };

const CONTROLLERS = {
  xbox: { name: "Xbox controller", face: XBOX_FACE, names: XBOX_NAMES, back: [], pads: [], gyro: false, steamInput: false },
  elite: { name: "Xbox Elite Series 2", face: XBOX_FACE, names: XBOX_NAMES, back: ["P1", "P2", "P3", "P4"], pads: [], gyro: false, steamInput: true },
  dualsense: { name: "DualSense", face: PLAYSTATION_FACE, names: PLAYSTATION_NAMES, back: [], pads: ["Touchpad"], gyro: true, steamInput: true },
  edge: { name: "DualSense Edge", face: PLAYSTATION_FACE, names: PLAYSTATION_NAMES, back: ["LB4", "RB4"], pads: ["Touchpad"], gyro: true, steamInput: true },
  steam: { name: "Steam Controller", face: XBOX_FACE, names: XBOX_NAMES, back: ["L4", "L5", "R4", "R5"], pads: ["Left trackpad", "Right trackpad"], gyro: true, steamInput: true },
  deck: { name: "Steam Deck", face: XBOX_FACE, names: XBOX_NAMES, back: ["L4", "L5", "R4", "R5"], pads: ["Left trackpad", "Right trackpad"], gyro: true, steamInput: true },
};

const BACK_LABELS = { P1: "P1 (upper left)", P2: "P2 (lower left)", P3: "P3 (upper right)", P4: "P4 (lower right)", LB4: "Left back", RB4: "Right back" };

const BACK_POSITION = {
  L4: ["27%", 28], L5: ["27%", 84], R4: ["73%", 28], R5: ["73%", 84],
  P1: ["27%", 28], P2: ["27%", 84], P3: ["73%", 28], P4: ["73%", 84],
  LB4: ["27%", 56], RB4: ["73%", 56],
};

const FREE_KEYS = ["F9", "F10", "F11", "F12", "F6", "F7", "F8"];
const KEY_NOTES = { F6: "", F7: "", F8: "bag key in WoW, PadPlan frees it", F9: "bag key in WoW, PadPlan frees it", F10: "bag key in WoW, PadPlan frees it", F11: "bag key in WoW, PadPlan frees it", F12: "bag key in WoW, PadPlan frees it" };
