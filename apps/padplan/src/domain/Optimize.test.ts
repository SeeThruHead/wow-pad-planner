import { assert, describe, it } from "@effect/vitest"
import { STARTERS } from "./Starters.ts"
import { foldBackIntoSlots, optimizeForBack } from "./Optimize.ts"
import { withController } from "./Layout.ts"
import { LAYERS } from "./Plan.ts"
import type { Plan } from "./Plan.ts"

const starter = (id: string): Plan => {
  const found = STARTERS.find((item) => item.id === `builtin:${id}`)
  if (!found) throw new Error(`no starter ${id}`)
  return found.plan
}

const refs = (plan: Plan): ReadonlyArray<string> =>
  [
    ...plan.sets.flatMap((set) => LAYERS.flatMap((layer) => Object.values(set.layers[layer]))),
    ...LAYERS.flatMap((layer) => Object.values(plan.paddles[layer]))
  ]
    .flatMap((entry) => ("ref" in entry ? [entry.ref] : []))
    .toSorted()

describe("rearranging for back buttons", () => {
  it("moves the most-pressed RT instants onto the no-trigger back buttons and loses nothing", () => {
    const plan = { ...withController(starter("warlock"), "steam"), useBackButtons: true }
    const result = optimizeForBack(plan)
    assert.deepStrictEqual(result.plan.paddles.base["L4"], { ref: "Corruption" })
    assert.strictEqual(result.plan.sets[0].layers.rt["X"], undefined)
    assert.deepStrictEqual(refs(result.plan), refs(plan))
    assert.strictEqual(result.moves[0]?.to, "No trigger + L4")
    assert.strictEqual(result.moves.length, 9)
  })

  it("keeps B on every layer for interrupts and emergency defensives", () => {
    const plan = { ...withController(starter("warlock"), "steam"), useBackButtons: true }
    const result = optimizeForBack(plan)
    assert.deepStrictEqual(result.plan.sets[0].layers.rt["B"], plan.sets[0].layers.rt["B"])
    assert.deepStrictEqual(result.plan.sets[0].layers.lt["B"], plan.sets[0].layers.lt["B"])
  })

  it("moves every back-button spell onto a free slot when the controller has none, losing nothing", () => {
    const plan = starter("shane-60")
    const result = foldBackIntoSlots(withController(plan, "xbox"))
    assert.deepStrictEqual(refs(result.plan), refs(plan))
    assert.strictEqual(
      LAYERS.every((layer) => Object.keys(result.plan.paddles[layer]).length === 0),
      true
    )
    assert.strictEqual(result.moves.length, 16)
  })
})
