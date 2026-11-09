import { Schema } from "effect"
import { Rpc } from "effect/rpc"
import { Unauthenticated } from "../account/Account.ts"
import { ViewerRpc } from "../account/Viewer.ts"
import { Saved } from "./Saved.ts"

export const MyLayouts = Rpc.make("MyLayouts", {
  payload: {},
  success: Schema.Array(Saved),
  error: Unauthenticated
}).middleware(ViewerRpc)

export const SaveLayout = Rpc.make("SaveLayout", {
  payload: { layout: Saved },
  success: Saved,
  error: Unauthenticated
}).middleware(ViewerRpc)
