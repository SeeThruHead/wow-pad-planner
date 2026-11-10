import { Effect, Option } from "effect"
import type { Nickname, UserId } from "../account/Account.ts"
import { Accounts } from "../account/AccountRepo.ts"
import { Forbidden, SubjectTaken, TokenNotFound, UserNotFound } from "./Admin.ts"
import type { MintedRole, TokenId, TokenInfo } from "./Admin.ts"
import { AdminGrant, requireSuper } from "./AdminRpc.ts"
import { Tokens } from "./TokenRepo.ts"

const existingUser = Effect.fnUntraced(function* (userId: UserId) {
  const accounts = yield* Accounts
  const user = yield* accounts.find(userId).pipe(Effect.orDie)
  if (Option.isNone(user)) return yield* new UserNotFound({ userId })
  return user.value
})

export const whoami = AdminGrant.pipe(Effect.withSpan("AdminHandlers.whoami"))

export const listUsers = Effect.gen(function* () {
  const accounts = yield* Accounts
  return yield* accounts.list.pipe(Effect.orDie)
}).pipe(Effect.withSpan("AdminHandlers.listUsers"))

export const createUser = Effect.fn("AdminHandlers.createUser")(function* (subject: string, nickname: Nickname | null) {
  const accounts = yield* Accounts
  const created = yield* accounts.create(subject, nickname).pipe(Effect.orDie)
  if (Option.isNone(created)) return yield* new SubjectTaken({ subject })
  return created.value
})

export const renameUser = Effect.fn("AdminHandlers.renameUser")(function* (userId: UserId, nickname: Nickname) {
  const accounts = yield* Accounts
  yield* existingUser(userId)
  return yield* accounts.setNickname(userId, nickname).pipe(Effect.orDie)
})

export const deleteUser = Effect.fn("AdminHandlers.deleteUser")(function* (userId: UserId) {
  const accounts = yield* Accounts
  yield* existingUser(userId)
  yield* accounts.remove(userId).pipe(Effect.orDie)
})

export const listTokens = Effect.gen(function* () {
  const tokens = yield* Tokens
  return yield* tokens.list.pipe(Effect.orDie)
}).pipe(Effect.withSpan("AdminHandlers.listTokens"))

const userTokenOwner = Effect.fnUntraced(function* (userId: UserId | null) {
  if (userId === null) return yield* new Forbidden({ message: "A user token needs the userId it acts as." })
  yield* existingUser(userId)
  return userId
})

export const mintToken = Effect.fn("AdminHandlers.mintToken")(function* (
  role: MintedRole,
  userId: UserId | null,
  label: string
) {
  const tokens = yield* Tokens
  if (role === "admin") yield* requireSuper
  const owner = role === "user" ? yield* userTokenOwner(userId) : null
  return yield* tokens.mint({ role, userId: owner, label }).pipe(Effect.orDie)
})

const mayRevoke = Effect.fnUntraced(function* (target: TokenInfo) {
  if (target.role === "super") {
    return yield* new Forbidden({ message: "Replace the super admin token with admin bootstrap --rotate." })
  }
  if (target.role === "admin") yield* requireSuper
})

export const revokeToken = Effect.fn("AdminHandlers.revokeToken")(function* (tokenId: TokenId) {
  const tokens = yield* Tokens
  const target = yield* tokens.find(tokenId).pipe(Effect.orDie)
  if (Option.isNone(target)) return yield* new TokenNotFound({ tokenId })
  yield* mayRevoke(target.value)
  yield* tokens.revoke(tokenId).pipe(Effect.orDie)
})
