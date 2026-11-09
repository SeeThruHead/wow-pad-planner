import { Context, DateTime, Effect, Layer, Option, Schema } from "effect"
import { Digest, SecureRandom } from "effect/crypto"
import { Base64Url, Hex } from "effect/encoding"
import { SqlClient, SqlSchema } from "effect/sql"
import { Nickname, User, UserId } from "./Account.ts"

export class AccountsError extends Schema.TaggedError<AccountsError, { readonly brand: unique symbol }>()(
  "AccountsError",
  { cause: Schema.Defect() }
) {}

const storeError = Effect.mapError((cause: unknown) => new AccountsError({ cause }))

const SESSION_DAYS = 30

export class Accounts extends Context.Service<
  Accounts,
  {
    readonly provision: (subject: string) => Effect.Effect<User, AccountsError>
    readonly issueSession: (userId: UserId) => Effect.Effect<string, AccountsError>
    readonly fromSession: (token: string) => Effect.Effect<Option.Option<User>, AccountsError>
    readonly endSession: (token: string) => Effect.Effect<void, AccountsError>
    readonly setNickname: (userId: UserId, nickname: Nickname) => Effect.Effect<User, AccountsError>
  }
>()("padplan/features/account/Accounts") {
  static readonly sqlite = Layer.effect(
    Accounts,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const random = yield* SecureRandom.SecureRandom
      const digests = yield* Digest.Digest

      const UserRow = Schema.Struct({ id: UserId, nickname: Schema.NullOr(Nickname) })
      const bySubject = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: UserRow,
        execute: (subject) => sql`SELECT id, nickname FROM users WHERE subject = ${subject}`
      })
      const byId = SqlSchema.findOne({
        Request: UserId,
        Result: UserRow,
        execute: (id) => sql`SELECT id, nickname FROM users WHERE id = ${id}`
      })
      const bySession = SqlSchema.findOneOption({
        Request: Schema.Struct({ hash: Schema.String, now: Schema.String }),
        Result: UserRow,
        execute: ({ hash, now }) =>
          sql`SELECT users.id, users.nickname FROM sessions JOIN users ON users.id = sessions.user_id
              WHERE sessions.token_hash = ${hash} AND sessions.expires_at > ${now}`
      })

      const hashOf = (token: string) =>
        digests.digest(Digest.sha256, new TextEncoder().encode(token)).pipe(Effect.map(Hex.encode))

      const newId = random.randomBytes(16).pipe(Effect.map((bytes) => UserId.make(Hex.encode(bytes))))

      const provision = Effect.fn("Accounts.provision")(function* (subject: string) {
        const existing = yield* bySubject(subject)
        if (Option.isSome(existing)) return existing.value
        const id = yield* newId
        const at = yield* DateTime.now
        const now = DateTime.formatIso(at)
        yield* sql`INSERT INTO users (id, subject, nickname, created_at) VALUES (${id}, ${subject}, NULL, ${now})`
        return { id, nickname: null }
      }, storeError)

      const issueSession = Effect.fn("Accounts.issueSession")(function* (userId: UserId) {
        const bytes = yield* random.randomBytes(32)
        const token = Base64Url.encode(bytes)
        const at = yield* DateTime.now
        const expires = DateTime.formatIso(DateTime.add(at, { days: SESSION_DAYS }))
        const hash = yield* hashOf(token)
        yield* sql`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${hash}, ${userId}, ${expires})`
        return token
      }, storeError)

      const fromSession = Effect.fn("Accounts.fromSession")(function* (token: string) {
        const at = yield* DateTime.now
        const hash = yield* hashOf(token)
        return yield* bySession({ hash, now: DateTime.formatIso(at) })
      }, storeError)

      const endSession = Effect.fn("Accounts.endSession")(function* (token: string) {
        const hash = yield* hashOf(token)
        yield* sql`DELETE FROM sessions WHERE token_hash = ${hash}`
      }, storeError)

      const setNickname = Effect.fn("Accounts.setNickname")(function* (userId: UserId, nickname: Nickname) {
        yield* sql`UPDATE users SET nickname = ${nickname} WHERE id = ${userId}`
        return yield* byId(userId)
      }, storeError)

      return Accounts.of({ provision, issueSession, fromSession, endSession, setNickname })
    })
  )
}
