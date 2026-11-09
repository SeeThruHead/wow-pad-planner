import { BunRuntime } from "@effect/platform-bun"
import { Layer } from "effect"
import { Main } from "./Main.ts"

Layer.launch(Main).pipe(BunRuntime.runMain)
