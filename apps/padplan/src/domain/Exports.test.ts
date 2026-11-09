import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { STARTERS } from "./Starters.ts"
import { addonCode, addonLines, readCode, toLua } from "./Exports.ts"
import type { Plan } from "./Plan.ts"

const starter = (id: string): Plan => {
  const found = STARTERS.find((item) => item.id === `builtin:${id}`)
  if (!found) throw new Error(`no starter ${id}`)
  return found.plan
}

const legacy = (file: string) => readFileSync(new URL(`../../../../dist/${file}`, import.meta.url), "utf8")

describe("exports", () => {
  it("writes the same PadPlanData.lua as the first planner", () => {
    assert.strictEqual(toLua(starter("shane")), legacy("shane-data.lua"))
  })

  it("writes the same layout code lines as the first planner", () => {
    const code = legacy("shane.padplan")
    const lines = new TextDecoder().decode(Uint8Array.from(atob(code.slice(9)), (c) => c.charCodeAt(0)))
    assert.strictEqual(addonLines(starter("shane")), lines)
  })

  it.effect("reads its own layout code back into the same layout", () =>
    Effect.gen(function* () {
      const plan = starter("shane-60")
      const read = yield* readCode(addonCode(plan))
      assert.deepStrictEqual(read, { ...plan, activeSet: 0 })
    })
  )

  it.effect("refuses text that isn't a layout", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(readCode("hello"))
      assert.strictEqual(error.message, "That isn't a layout from this planner.")
    })
  )
})
