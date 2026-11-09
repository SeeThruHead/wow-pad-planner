import { BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"
Effect.void.pipe(BunRuntime.runMain)
