import { Context, Effect, Layer, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { Character } from "../../domain/Character.ts"
import { UserId } from "../account/Account.ts"
import { SavedCharacter } from "./Saved.ts"

export class CharacterRepoError extends Schema.TaggedError<CharacterRepoError, { readonly brand: unique symbol }>()(
  "CharacterRepoError",
  { cause: Schema.Defect() }
) {}

const repoError = Effect.mapError((cause: unknown) => new CharacterRepoError({ cause }))

const Row = Schema.Struct({ data: Schema.fromJsonString(Character), deleted: Schema.Int })
const toSaved = (row: typeof Row.Type): SavedCharacter => ({ character: row.data, deleted: row.deleted === 1 })

export class CharacterRepo extends Context.Service<
  CharacterRepo,
  {
    readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<SavedCharacter>, CharacterRepoError>
    readonly save: (userId: UserId, saved: SavedCharacter) => Effect.Effect<SavedCharacter, CharacterRepoError>
  }
>()("padplan/features/characters/CharacterRepo") {
  static readonly sqlite = Layer.effect(
    CharacterRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const rows = SqlSchema.findAll({
        Request: UserId,
        Result: Row,
        execute: (userId) => sql`SELECT data, deleted FROM characters WHERE user_id = ${userId}`
      })
      const one = SqlSchema.findOne({
        Request: Schema.Struct({ userId: UserId, id: Schema.String }),
        Result: Row,
        execute: ({ userId, id }) => sql`SELECT data, deleted FROM characters WHERE user_id = ${userId} AND id = ${id}`
      })
      const encode = Schema.encodeEffect(Schema.fromJsonString(Character))

      const list = Effect.fn("CharacterRepo.list")(function* (userId: UserId) {
        const found = yield* rows(userId)
        return found.map(toSaved)
      }, repoError)

      const save = Effect.fn("CharacterRepo.save")(function* (userId: UserId, saved: SavedCharacter) {
        const data = yield* encode(saved.character)
        const id = saved.character.id
        const updatedAt = saved.character.updatedAt
        const deleted = saved.deleted ? 1 : 0
        yield* sql`
          INSERT INTO characters (user_id, id, data, updated_at, deleted)
          VALUES (${userId}, ${id}, ${data}, ${updatedAt}, ${deleted})
          ON CONFLICT (user_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted
          WHERE excluded.updated_at > characters.updated_at
        `
        const row = yield* one({ userId, id })
        return toSaved(row)
      }, repoError)

      return CharacterRepo.of({ list, save })
    })
  )
}
