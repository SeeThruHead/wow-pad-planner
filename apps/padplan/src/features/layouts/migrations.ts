import { Effect } from "effect"
import { SqlClient } from "effect/sql"

export const migrations = {
  "2026110902_layouts": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`
      CREATE TABLE layouts (
        user_id TEXT NOT NULL REFERENCES users(id),
        id TEXT NOT NULL,
        plan TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, id)
      )
    `
  })
}
