import { Effect, Option } from "effect"
import type { Nickname } from "./Account.ts"
import { Accounts } from "./AccountRepo.ts"
import { Viewer, signedInUser } from "./Viewer.ts"

export const me = Effect.gen(function* () {
  const viewer = yield* Viewer
  return Option.getOrNull(viewer)
}).pipe(Effect.withSpan("AccountHandlers.me"))

export const setNickname = Effect.fn("AccountHandlers.setNickname")(function* (nickname: Nickname) {
  const user = yield* signedInUser
  const accounts = yield* Accounts
  return yield* accounts.setNickname(user.id, nickname).pipe(Effect.orDie)
})
