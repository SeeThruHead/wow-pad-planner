import { Effect } from "effect"
import { signedInUser } from "../account/Viewer.ts"
import { LayoutStore } from "./LayoutRepo.ts"
import type { Saved } from "./Saved.ts"

export const myLayouts = Effect.gen(function* () {
  const user = yield* signedInUser
  const store = yield* LayoutStore
  return yield* store.list(user.id).pipe(Effect.orDie)
}).pipe(Effect.withSpan("LayoutHandlers.mine"))

export const saveLayout = Effect.fn("LayoutHandlers.save")(function* (layout: Saved) {
  const user = yield* signedInUser
  const store = yield* LayoutStore
  return yield* store.save(user.id, layout).pipe(Effect.orDie)
})
