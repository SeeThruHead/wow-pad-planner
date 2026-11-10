import { Schema } from "effect"
import { Rpc } from "effect/rpc"
import { Nickname, User, UserId, UserRecord } from "../account/Account.ts"
import {
  Forbidden,
  Grant,
  MintedRole,
  MintedToken,
  SubjectTaken,
  TokenId,
  TokenInfo,
  TokenNotFound,
  UserNotFound
} from "./Admin.ts"
import { AdminRpc } from "./AdminRpc.ts"

export const AdminWhoami = Rpc.make("AdminWhoami", { payload: {}, success: Grant }).middleware(AdminRpc)

export const AdminListUsers = Rpc.make("AdminListUsers", {
  payload: {},
  success: Schema.Array(UserRecord)
}).middleware(AdminRpc)

export const AdminCreateUser = Rpc.make("AdminCreateUser", {
  payload: { subject: Schema.NonEmptyString, nickname: Schema.NullOr(Nickname) },
  success: UserRecord,
  error: SubjectTaken
}).middleware(AdminRpc)

export const AdminRenameUser = Rpc.make("AdminRenameUser", {
  payload: { userId: UserId, nickname: Nickname },
  success: User,
  error: UserNotFound
}).middleware(AdminRpc)

export const AdminDeleteUser = Rpc.make("AdminDeleteUser", {
  payload: { userId: UserId },
  error: UserNotFound
}).middleware(AdminRpc)

export const AdminListTokens = Rpc.make("AdminListTokens", {
  payload: {},
  success: Schema.Array(TokenInfo)
}).middleware(AdminRpc)

export const AdminMintToken = Rpc.make("AdminMintToken", {
  payload: { role: MintedRole, userId: Schema.NullOr(UserId), label: Schema.NonEmptyString },
  success: MintedToken,
  error: Schema.Union([Forbidden, UserNotFound])
}).middleware(AdminRpc)

export const AdminRevokeToken = Rpc.make("AdminRevokeToken", {
  payload: { tokenId: TokenId },
  error: Schema.Union([Forbidden, TokenNotFound])
}).middleware(AdminRpc)
