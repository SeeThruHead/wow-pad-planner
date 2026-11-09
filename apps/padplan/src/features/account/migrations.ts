import { Effect } from "effect"
import { SqlClient } from "effect/sql"

export const migrations = {
  "2026110901_accounts": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL UNIQUE,
        nickname TEXT,
        created_at TEXT NOT NULL
      )
    `
    yield* sql`
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        expires_at TEXT NOT NULL
      )
    `
  })
}
