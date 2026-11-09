import { migrations as accounts } from "../features/account/migrations.ts"
import { migrations as layouts } from "../features/layouts/migrations.ts"
import type { Migrations } from "../framework/Database.ts"

export const migrations: Migrations = { ...accounts, ...layouts }
