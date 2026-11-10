import { BunCrypto } from "@effect/platform-bun"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"
import { SqlClient } from "effect/sql"
import { migrations } from "../../app/migrations.ts"
import * as Database from "../../framework/Database.ts"
import { Accounts } from "../account/AccountRepo.ts"
import type { Grant } from "./Admin.ts"
import { AdminGrant } from "./AdminRpc.ts"
import * as Admin from "./handlers.ts"
import { Tokens } from "./TokenRepo.ts"

const Store = Layer.mergeAll(Tokens.sqlite, Accounts.sqlite).pipe(
  Layer.provideMerge(Database.layer({ filename: ":memory:", migrations })),
  Layer.provide(BunCrypto.layer)
)

const grantOf = Effect.fnUntraced(function* (token: string) {
  const tokens = yield* Tokens
  const grant = yield* tokens.authenticate(token)
  return Option.getOrThrow(grant)
})

const superAdmin = Effect.gen(function* () {
  const tokens = yield* Tokens
  const token = yield* tokens.bootstrap({ rotate: false })
  return yield* grantOf(token)
})

const as = (grant: Grant) => Effect.provideService(AdminGrant, grant)

describe("admin bootstrap", () => {
  it.effect("prints a super token once and refuses a second bootstrap", () =>
    Effect.gen(function* () {
      const tokens = yield* Tokens
      const token = yield* tokens.bootstrap({ rotate: false })
      const grant = yield* grantOf(token)
      const again = yield* Effect.flip(tokens.bootstrap({ rotate: false }))
      assert.strictEqual(grant.role, "super")
      assert.isTrue(token.startsWith("pp_"))
      assert.strictEqual(again._tag, "SuperAdminExists")
    }).pipe(Effect.provide(Store))
  )

  it.effect("rotate revokes the old super token", () =>
    Effect.gen(function* () {
      const tokens = yield* Tokens
      const first = yield* tokens.bootstrap({ rotate: false })
      const second = yield* tokens.bootstrap({ rotate: true })
      const old = yield* tokens.authenticate(first)
      const current = yield* tokens.authenticate(second)
      assert.isTrue(Option.isNone(old))
      assert.isTrue(Option.isSome(current))
    }).pipe(Effect.provide(Store))
  )

  it.effect("stores only the hash", () =>
    Effect.gen(function* () {
      const tokens = yield* Tokens
      const sql = yield* SqlClient.SqlClient
      const token = yield* tokens.bootstrap({ rotate: false })
      const rows = yield* sql<{ readonly token_hash: string }>`SELECT token_hash FROM api_tokens`
      assert.deepStrictEqual(
        rows.map((row) => row.token_hash.length),
        [64]
      )
      assert.notStrictEqual(rows[0]?.token_hash, token)
    }).pipe(Effect.provide(Store))
  )
})

describe("admin api", () => {
  it.effect("super mints an admin token, which can manage users but not mint admins", () =>
    Effect.gen(function* () {
      const superGrant = yield* superAdmin
      const minted = yield* Admin.mintToken("admin", null, "agent").pipe(as(superGrant))
      const adminGrant = yield* grantOf(minted.token)
      const user = yield* Admin.createUser("agent:test", null).pipe(as(adminGrant))
      const refused = yield* Effect.flip(Admin.mintToken("admin", null, "another").pipe(as(adminGrant)))
      const userToken = yield* Admin.mintToken("user", user.id, "acts as test").pipe(as(adminGrant))
      const userGrant = yield* grantOf(userToken.token)
      assert.strictEqual(adminGrant.role, "admin")
      assert.strictEqual(refused._tag, "Forbidden")
      assert.strictEqual(userGrant.userId, user.id)
    }).pipe(Effect.provide(Store))
  )

  it.effect("the super token can't be revoked through the api", () =>
    Effect.gen(function* () {
      const superGrant = yield* superAdmin
      const refused = yield* Effect.flip(Admin.revokeToken(superGrant.tokenId).pipe(as(superGrant)))
      assert.strictEqual(refused._tag, "Forbidden")
    }).pipe(Effect.provide(Store))
  )

  it.effect("deleting a user removes its tokens", () =>
    Effect.gen(function* () {
      const tokens = yield* Tokens
      const superGrant = yield* superAdmin
      const user = yield* Admin.createUser("agent:gone", null).pipe(as(superGrant))
      const userToken = yield* Admin.mintToken("user", user.id, "gone").pipe(as(superGrant))
      yield* Admin.deleteUser(user.id).pipe(as(superGrant))
      const after = yield* tokens.authenticate(userToken.token)
      const missing = yield* Effect.flip(Admin.deleteUser(user.id).pipe(as(superGrant)))
      assert.isTrue(Option.isNone(after))
      assert.strictEqual(missing._tag, "UserNotFound")
    }).pipe(Effect.provide(Store))
  )
})
