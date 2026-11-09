import { Schema } from "effect"
import { Rpc } from "effect/rpc"
import { Unauthenticated } from "../account/Account.ts"
import { ViewerRpc } from "../account/Viewer.ts"
import { SavedCharacter } from "./Saved.ts"

export const MyCharacters = Rpc.make("MyCharacters", {
  payload: {},
  success: Schema.Array(SavedCharacter),
  error: Unauthenticated
}).middleware(ViewerRpc)

export const SaveCharacter = Rpc.make("SaveCharacter", {
  payload: { saved: SavedCharacter },
  success: SavedCharacter,
  error: Unauthenticated
}).middleware(ViewerRpc)
