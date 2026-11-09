import { Context, Effect, Layer, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { Plan } from "../../domain/Plan.ts"
import { UserId } from "../account/Account.ts"
import { LayoutId, Saved } from "./Saved.ts"

export class LayoutStoreError extends Schema.TaggedError<LayoutStoreError, { readonly brand: unique symbol }>()(
  "LayoutStoreError",
  { cause: Schema.Defect() }
) {}

const storeError = Effect.mapError((cause: unknown) => new LayoutStoreError({ cause }))

export class LayoutStore extends Context.Service<
  LayoutStore,
  {
    readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<Saved>, LayoutStoreError>
    readonly save: (userId: UserId, layout: Saved) => Effect.Effect<Saved, LayoutStoreError>
  }
>()("padplan/features/layouts/LayoutStore") {
  static readonly sqlite = Layer.effect(
    LayoutStore,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const Row = Schema.Struct({
        id: LayoutId,
        plan: Schema.fromJsonString(Plan),
        updated_at: Schema.Int,
        deleted: Schema.Int
      })
      const toSaved = (row: typeof Row.Type): Saved => ({
        id: row.id,
        plan: row.plan,
        updatedAt: row.updated_at,
        deleted: row.deleted === 1
      })
      const rows = SqlSchema.findAll({
        Request: UserId,
        Result: Row,
        execute: (userId) => sql`SELECT id, plan, updated_at, deleted FROM layouts WHERE user_id = ${userId}`
      })
      const one = SqlSchema.findOne({
        Request: Schema.Struct({ userId: UserId, id: LayoutId }),
        Result: Row,
        execute: ({ userId, id }) =>
          sql`SELECT id, plan, updated_at, deleted FROM layouts WHERE user_id = ${userId} AND id = ${id}`
      })
      const encodePlan = Schema.encodeEffect(Schema.fromJsonString(Plan))

      const list = Effect.fn("LayoutStore.list")(function* (userId: UserId) {
        const found = yield* rows(userId)
        return found.map(toSaved)
      }, storeError)

      const save = Effect.fn("LayoutStore.save")(function* (userId: UserId, layout: Saved) {
        const plan = yield* encodePlan(layout.plan)
        yield* sql`
          INSERT INTO layouts (user_id, id, plan, updated_at, deleted)
          VALUES (${userId}, ${layout.id}, ${plan}, ${layout.updatedAt}, ${layout.deleted ? 1 : 0})
          ON CONFLICT (user_id, id) DO UPDATE SET plan = excluded.plan, updated_at = excluded.updated_at, deleted = excluded.deleted
          WHERE excluded.updated_at > layouts.updated_at
        `
        const row = yield* one({ userId, id: layout.id })
        return toSaved(row)
      }, storeError)

      return LayoutStore.of({ list, save })
    })
  )
}
