import { Effect } from "effect"
import { SqlClient } from "effect/sql"

export const migrations = {
  "2026110904_api_tokens": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`
      CREATE TABLE api_tokens (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('super', 'admin', 'user')),
        user_id TEXT REFERENCES users(id),
        label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        revoked_at TEXT,
        CHECK ((role = 'user') = (user_id IS NOT NULL))
      )
    `
    yield* sql`CREATE UNIQUE INDEX one_active_super ON api_tokens (role) WHERE role = 'super' AND revoked_at IS NULL`
  })
}
