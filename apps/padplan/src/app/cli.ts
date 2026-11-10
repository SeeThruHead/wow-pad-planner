import { BunCrypto, BunRuntime, BunServices } from "@effect/platform-bun"
import { Cause, Config, Console, Effect, Layer, Logger } from "effect"
import { Command, Flag } from "effect/cli"
import { Tokens } from "../features/admin/TokenRepo.ts"
import * as Database from "../framework/Database.ts"
import { migrations } from "./migrations.ts"

const Store = Layer.unwrap(
  Effect.gen(function* () {
    const dataDir = yield* Config.String("DATA_DIR").pipe(Config.withDefault("/data"))

    return Tokens.sqlite.pipe(
      Layer.provide(Database.layer({ filename: `${dataDir}/padplan.db`, migrations })),
      Layer.provide(BunCrypto.layer)
    )
  })
)

const bootstrap = Command.make(
  "bootstrap",
  {
    rotate: Flag.Boolean("rotate").pipe(
      Flag.withDescription("Revoke the current super admin token and print a new one"),
      Flag.withDefault(false)
    )
  },
  Effect.fn("Cli.bootstrap")(function* ({ rotate }) {
    const tokens = yield* Tokens
    const token = yield* tokens.bootstrap({ rotate })
    yield* Console.log(token)
  })
).pipe(Command.withDescription("Create the super admin and print only its token on stdout"))

const admin = Command.make("admin").pipe(
  Command.withDescription("Administer this PadPlan server"),
  Command.withSubcommands([bootstrap])
)

const program = Command.make("padplan").pipe(
  Command.withSubcommands([admin]),
  Command.run({ version: "1.0.0" }),
  Effect.provide(Store.pipe(Layer.provideMerge(BunServices.layer))),
  Effect.tapCause((cause) => Console.error(Cause.pretty(cause))),
  Effect.provideService(Logger.LogToStderr, true)
)

BunRuntime.runMain(program, { disableErrorReporting: true })
