import { Context, Effect, Layer, Option } from "effect"
import { Cookies, Headers } from "effect/http"
import { RpcMiddleware } from "effect/rpc"
import { Tokens, bearerToken } from "../admin/TokenRepo.ts"
import type { User } from "./Account.ts"
import { signInFirst } from "./Account.ts"
import { Accounts } from "./AccountRepo.ts"

export const SESSION_COOKIE = "padplan_session"
export const LOGIN_COOKIE = "padplan_login"

export class Viewer extends Context.Service<Viewer, Option.Option<User>>()("padplan/features/account/Viewer") {}

export class ViewerRpc extends RpcMiddleware.Service<ViewerRpc, { provides: Viewer }>()(
  "padplan/features/account/ViewerRpc"
) {}

export const sessionToken = (headers: Headers.Headers): Option.Option<string> =>
  Headers.get(headers, "cookie").pipe(
    Option.flatMap((header) => Option.fromNullishOr(Cookies.parseHeader(header)[SESSION_COOKIE]))
  )

const fromBearer = Effect.fnUntraced(function* (token: string) {
  const accounts = yield* Accounts
  const tokens = yield* Tokens
  const grant = yield* tokens.authenticate(token).pipe(Effect.orDie)
  const userId = Option.flatMapNullishOr(grant, (found) => found.userId)
  if (Option.isNone(userId)) return Option.none<User>()
  return yield* accounts.find(userId.value).pipe(Effect.orDie)
})

export const viewerOf = Effect.fn("Viewer.of")(function* (headers: Headers.Headers) {
  const accounts = yield* Accounts
  const bearer = bearerToken(headers)
  if (Option.isSome(bearer)) return yield* fromBearer(bearer.value)
  const token = sessionToken(headers)
  if (Option.isNone(token)) return Option.none<User>()
  return yield* accounts.fromSession(token.value).pipe(Effect.orDie)
})

export const viewerRpcLayer = Layer.effect(
  ViewerRpc,
  Effect.gen(function* () {
    const context = yield* Effect.context<Accounts | Tokens>()
    return ViewerRpc.of(
      Effect.fnUntraced(function* (effect, { headers }) {
        const viewer = yield* viewerOf(headers).pipe(Effect.provideContext(context))
        return yield* Effect.provideService(effect, Viewer, viewer)
      })
    )
  })
)

export const signedInUser = Effect.gen(function* () {
  const viewer = yield* Viewer
  if (Option.isNone(viewer)) return yield* signInFirst
  return viewer.value
})
