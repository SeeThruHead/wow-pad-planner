import { used } from "../../../features/log/handlers.ts"
import { kind } from "../../../domains/tracking/Entry.ts"
import { Database } from "bun:sqlite"
import { used as service } from "../../../domains/identity/Identity.ts"
import { used as shared } from "../../../domains/catalogue/Catalogue.ts"
import { used as database } from "@sth-life/framework/Database.ts"
export const all = [used, kind, Database, service, shared, database]
