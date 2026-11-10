import { Context, DateTime, Effect, Layer, Option, Schema } from "effect"
import { Digest, SecureRandom } from "effect/crypto"
import { Base64Url, Hex } from "effect/encoding"
import { Headers } from "effect/http"
import { SqlClient, SqlSchema } from "effect/sql"
import { UserId } from "../account/Account.ts"
import { Grant, TokenId, TokenInfo, TokenRole } from "./Admin.ts"
import type { MintedRole, MintedToken } from "./Admin.ts"

export class TokensError extends Schema.TaggedError<TokensError, { readonly brand: unique symbol }>()("TokensError", {
  cause: Schema.Defect()
}) {}

export class SuperAdminExists extends Schema.TaggedError<SuperAdminExists, { readonly brand: unique symbol }>()(
  "SuperAdminExists",
  { message: Schema.String }
) {}

const storeError = Effect.mapError((cause: unknown) => new TokensError({ cause }))

const TOKEN_PREFIX = "pp_"

const InfoRow = Schema.Struct({
  id: TokenId,
  role: TokenRole,
  user_id: Schema.NullOr(UserId),
  label: Schema.String,
  created_at: Schema.String,
  revoked_at: Schema.NullOr(Schema.String)
})

const toInfo = (row: typeof InfoRow.Type): TokenInfo => ({
  id: row.id,
  role: row.role,
  userId: row.user_id,
  label: row.label,
  createdAt: row.created_at,
  revokedAt: row.revoked_at
})

const GrantRow = Schema.Struct({ id: TokenId, role: TokenRole, user_id: Schema.NullOr(UserId) })

export class Tokens extends Context.Service<
  Tokens,
  {
    readonly bootstrap: (options: { readonly rotate: boolean }) => Effect.Effect<string, SuperAdminExists | TokensError>
    readonly authenticate: (token: string) => Effect.Effect<Option.Option<Grant>, TokensError>
    readonly mint: (request: {
      readonly role: MintedRole
      readonly userId: UserId | null
      readonly label: string
    }) => Effect.Effect<MintedToken, TokensError>
    readonly list: Effect.Effect<ReadonlyArray<TokenInfo>, TokensError>
    readonly find: (id: TokenId) => Effect.Effect<Option.Option<TokenInfo>, TokensError>
    readonly revoke: (id: TokenId) => Effect.Effect<void, TokensError>
  }
>()("padplan/features/admin/Tokens") {
  static readonly sqlite = Layer.effect(
    Tokens,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const random = yield* SecureRandom.SecureRandom
      const digests = yield* Digest.Digest

      const infoColumns = sql`id, role, user_id, label, created_at, revoked_at`
      const allRows = SqlSchema.findAll({
        Request: Schema.Void,
        Result: InfoRow,
        execute: () => sql`SELECT ${infoColumns} FROM api_tokens ORDER BY created_at, id`
      })
      const byId = SqlSchema.findOneOption({
        Request: TokenId,
        Result: InfoRow,
        execute: (id) => sql`SELECT ${infoColumns} FROM api_tokens WHERE id = ${id}`
      })
      const activeByHash = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: GrantRow,
        execute: (hash) =>
          sql`SELECT id, role, user_id FROM api_tokens WHERE token_hash = ${hash} AND revoked_at IS NULL`
      })
      const activeSuper = SqlSchema.findOneOption({
        Request: Schema.Void,
        Result: Schema.Struct({ id: TokenId }),
        execute: () => sql`SELECT id FROM api_tokens WHERE role = 'super' AND revoked_at IS NULL`
      })

      const hashOf = (token: string) =>
        digests.digest(Digest.sha256, new TextEncoder().encode(token)).pipe(Effect.map(Hex.encode))

      const nowIso = DateTime.now.pipe(Effect.map(DateTime.formatIso))
      const newId = random.randomBytes(16).pipe(Effect.map((bytes) => TokenId.make(Hex.encode(bytes))))
      const newSecret = random.randomBytes(32).pipe(Effect.map((bytes) => `${TOKEN_PREFIX}${Base64Url.encode(bytes)}`))

      const insert = Effect.fnUntraced(function* (role: TokenRole, userId: UserId | null, label: string) {
        const id = yield* newId
        const token = yield* newSecret
        const hash = yield* hashOf(token)
        const createdAt = yield* nowIso
        yield* sql`INSERT INTO api_tokens (id, token_hash, role, user_id, label, created_at)
                   VALUES (${id}, ${hash}, ${role}, ${userId}, ${label}, ${createdAt})`
        const info: TokenInfo = { id, role, userId, label, createdAt, revokedAt: null }
        return { info, token }
      })

      const revokeSupers = Effect.fnUntraced(function* () {
        const at = yield* nowIso
        yield* sql`UPDATE api_tokens SET revoked_at = ${at} WHERE role = 'super' AND revoked_at IS NULL`
      })

      const issueSuper = Effect.fnUntraced(function* (rotate: boolean) {
        const existing = yield* activeSuper(undefined)
        if (Option.isSome(existing) && !rotate) return Option.none<string>()
        yield* revokeSupers()
        const minted = yield* insert("super", null, "super admin")
        return Option.some(minted.token)
      }, sql.withTransaction)

      const bootstrap = Effect.fn("Tokens.bootstrap")(function* (options: { readonly rotate: boolean }) {
        const token = yield* issueSuper(options.rotate).pipe(storeError)
        if (Option.isNone(token)) {
          return yield* new SuperAdminExists({
            message: "A super admin already exists. Run with --rotate to replace its token."
          })
        }
        return token.value
      })

      const authenticate = Effect.fn("Tokens.authenticate")(function* (token: string) {
        if (!token.startsWith(TOKEN_PREFIX)) return Option.none<Grant>()
        const hash = yield* hashOf(token)
        const row = yield* activeByHash(hash)
        return Option.map(row, (found): Grant => ({ tokenId: found.id, role: found.role, userId: found.user_id }))
      }, storeError)

      const mint = Effect.fn("Tokens.mint")(function* (request: {
        readonly role: MintedRole
        readonly userId: UserId | null
        readonly label: string
      }) {
        return yield* insert(request.role, request.userId, request.label)
      }, storeError)

      const list = allRows(undefined).pipe(
        Effect.map((rows) => rows.map(toInfo)),
        storeError,
        Effect.withSpan("Tokens.list")
      )

      const find = Effect.fn("Tokens.find")(function* (id: TokenId) {
        const row = yield* byId(id)
        return Option.map(row, toInfo)
      }, storeError)

      const revoke = Effect.fn("Tokens.revoke")(function* (id: TokenId) {
        const at = yield* nowIso
        yield* sql`UPDATE api_tokens SET revoked_at = ${at} WHERE id = ${id} AND revoked_at IS NULL`
      }, storeError)

      return Tokens.of({ bootstrap, authenticate, mint, list, find, revoke })
    })
  )
}

const BEARER = /^Bearer\s+(\S+)$/i

export const bearerToken = (headers: Headers.Headers): Option.Option<string> =>
  Headers.get(headers, "authorization").pipe(Option.flatMapNullishOr((header) => BEARER.exec(header)?.[1]))
