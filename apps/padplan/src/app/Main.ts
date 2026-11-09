import { BunCrypto, BunHttpServer, BunServices } from "@effect/platform-bun"
import { Config, Effect, Layer, Option } from "effect"
import { FetchHttpClient, HttpRouter, HttpStaticServer } from "effect/http"
import { Accounts } from "../features/account/AccountRepo.ts"
import { Oidc } from "../features/account/Oidc.ts"
import { signInRoutes, signInUnavailable } from "../features/account/routes.ts"
import { CharacterRepo } from "../features/characters/CharacterRepo.ts"
import { LayoutStore } from "../features/layouts/LayoutRepo.ts"
import * as Database from "../framework/Database.ts"
import { migrations } from "./migrations.ts"
import { Routes } from "./Routes.ts"

const AppConfig = Config.all({
  port: Config.Port("PORT").pipe(Config.withDefault(3000)),
  dataDir: Config.String("DATA_DIR").pipe(Config.withDefault("/data")),
  publicUrl: Config.URL("PUBLIC_URL").pipe(Config.withDefault(new URL("http://localhost:3000"))),
  clientDir: Config.option(Config.String("CLIENT_DIR"))
})

const OidcSettings = Config.all({
  issuer: Config.URL("OIDC_ISSUER"),
  clientId: Config.NonEmptyString("OIDC_CLIENT_ID"),
  clientSecret: Config.Redacted("OIDC_CLIENT_SECRET")
}).pipe(Config.option)

const hashedAssets = "public, max-age=31536000, immutable"

const Client = (root: Option.Option<string>) =>
  Option.match(root, {
    onNone: () => Layer.empty,
    onSome: (path) =>
      Layer.mergeAll(
        HttpStaticServer.layer({ root: path, spa: true, cacheControl: "no-cache" }),
        HttpStaticServer.layer({ root: `${path}/assets`, prefix: "/assets", cacheControl: hashedAssets })
      )
  })

export const Main = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig
    const oidc = yield* OidcSettings
    const redirectUri = new URL("/auth/callback", config.publicUrl)
    const secure = config.publicUrl.protocol === "https:"
    const SignIn = Option.match(oidc, {
      onNone: () => signInUnavailable,
      onSome: (settings) =>
        signInRoutes({ secure, redirectUri }).pipe(Layer.provide(Oidc.layer({ ...settings, redirectUri })))
    })

    return HttpRouter.serve(Layer.mergeAll(Routes, SignIn, Client(config.clientDir)), { disableLogger: true }).pipe(
      Layer.provide(Layer.mergeAll(Accounts.sqlite, LayoutStore.sqlite, CharacterRepo.sqlite)),
      Layer.provide(Database.layer({ filename: `${config.dataDir}/padplan.db`, migrations })),
      Layer.provide(Layer.mergeAll(BunCrypto.layer, BunServices.layer, FetchHttpClient.layer)),
      Layer.provideMerge(BunHttpServer.layer({ port: config.port }))
    )
  })
)
