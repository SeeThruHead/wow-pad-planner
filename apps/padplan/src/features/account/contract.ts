import { Schema } from "effect"
import { Rpc } from "effect/rpc"
import { Nickname, Unauthenticated, User } from "./Account.ts"
import { ViewerRpc } from "./Viewer.ts"

export const Me = Rpc.make("Me", { payload: {}, success: Schema.NullOr(User) }).middleware(ViewerRpc)

export const SetNickname = Rpc.make("SetNickname", {
  payload: { nickname: Nickname },
  success: User,
  error: Unauthenticated
}).middleware(ViewerRpc)
