import { Effect } from "effect"
import { signedInUser } from "../account/Viewer.ts"
import { CharacterRepo } from "./CharacterRepo.ts"
import type { SavedCharacter } from "./Saved.ts"

export const myCharacters = Effect.gen(function* () {
  const user = yield* signedInUser
  const repo = yield* CharacterRepo
  return yield* repo.list(user.id).pipe(Effect.orDie)
}).pipe(Effect.withSpan("CharacterHandlers.mine"))

export const saveCharacter = Effect.fn("CharacterHandlers.save")(function* (saved: SavedCharacter) {
  const user = yield* signedInUser
  const repo = yield* CharacterRepo
  return yield* repo.save(user.id, saved).pipe(Effect.orDie)
})
