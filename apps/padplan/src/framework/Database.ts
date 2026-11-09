import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-bun"
import { Layer } from "effect"
import type { Effect } from "effect"
import type { SqlClient } from "effect/sql"

export type Migrations = Readonly<Record<string, Effect.Effect<void, unknown, SqlClient.SqlClient>>>

export const layer = (options: { readonly filename: string; readonly migrations: Migrations }) =>
  SqliteMigrator.layer({ loader: SqliteMigrator.fromRecord(options.migrations) }).pipe(
    Layer.provideMerge(SqliteClient.layer({ filename: options.filename }))
  )
