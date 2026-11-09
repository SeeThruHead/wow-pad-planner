import { assert, describe, it } from "@effect/vitest"
import { STARTERS } from "./Starters.ts"
import { toLua, toLuaFile } from "./Exports.ts"
import { migrateOldLayouts } from "../client/app/library.ts"
import type { Character } from "./Character.ts"

const starterPlan = (id: string) => {
  const found = STARTERS.find((starter) => starter.id === `builtin:${id}`)
  if (!found) throw new Error(`no starter ${id}`)
  return found.plan
}

const shane60 = starterPlan("shane-60")
const mage = starterPlan("mage")

const mimesis: Character = {
  id: "c1",
  name: "Mimesis",
  className: "WARLOCK",
  level: 60,
  realm: "Seethruhead",
  layouts: [
    { id: "l1", name: "Leveling", plan: shane60 },
    { id: "l2", name: "Dungeons", plan: shane60 }
  ],
  activeLayoutId: "l2",
  updatedAt: 1,
  autoload: "auto"
}

describe("characters", () => {
  it("moves saved layouts into one character per class, without the copy suffixes", () => {
    const characters = migrateOldLayouts(
      [
        { id: "a", plan: { ...shane60, name: "Warlock starter (my copy)" } },
        { id: "b", plan: { ...mage, name: "Frost (copy)" } },
        { id: "c", plan: { ...shane60, name: "Raid" } }
      ],
      "dev"
    )
    assert.deepStrictEqual(
      characters.map((character) => [character.className, character.layouts.map((layout) => layout.name)]),
      [
        ["WARLOCK", ["Warlock starter", "Raid"]],
        ["MAGE", ["Frost"]]
      ]
    )
  })

  it("writes each character's active layout into PadPlanData.lua under its name and realm", () => {
    const file = toLuaFile([mimesis])
    assert.include(file, '["Mimesis-Seethruhead"] = {\n      autoload = "auto",')
    assert.include(file, 'name = "Dungeons"')
    assert.notInclude(file, 'name = "Leveling"')
    const backButtonLine = toLua({ ...shane60, name: "Dungeons", level: 60 })
      .split("\n")
      .find((line) => line.includes("R4 = "))
    assert.include(file, backButtonLine?.trim() ?? "missing back-button line")
  })
})
