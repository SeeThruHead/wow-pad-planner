import { Schema } from "effect"
import { UserId } from "../account/Account.ts"

export const TokenId = Schema.String.pipe(Schema.brand("TokenId"))
export type TokenId = typeof TokenId.Type

export const MintedRole = Schema.Literals(["admin", "user"])
export type MintedRole = typeof MintedRole.Type

export const TokenRole = Schema.Literals(["super", "admin", "user"])
export type TokenRole = typeof TokenRole.Type

export const TokenInfo = Schema.Struct({
  id: TokenId,
  role: TokenRole,
  userId: Schema.NullOr(UserId),
  label: Schema.String,
  createdAt: Schema.String,
  revokedAt: Schema.NullOr(Schema.String)
})
export type TokenInfo = typeof TokenInfo.Type

export const MintedToken = Schema.Struct({ info: TokenInfo, token: Schema.String })
export type MintedToken = typeof MintedToken.Type

export const Grant = Schema.Struct({ tokenId: TokenId, role: TokenRole, userId: Schema.NullOr(UserId) })
export type Grant = typeof Grant.Type

export class Forbidden extends Schema.TaggedError<Forbidden, { readonly brand: unique symbol }>()("Forbidden", {
  message: Schema.String
}) {}

export class UserNotFound extends Schema.TaggedError<UserNotFound, { readonly brand: unique symbol }>()(
  "UserNotFound",
  { userId: UserId }
) {}

export class TokenNotFound extends Schema.TaggedError<TokenNotFound, { readonly brand: unique symbol }>()(
  "TokenNotFound",
  { tokenId: TokenId }
) {}

export class SubjectTaken extends Schema.TaggedError<SubjectTaken, { readonly brand: unique symbol }>()(
  "SubjectTaken",
  { subject: Schema.String }
) {}
