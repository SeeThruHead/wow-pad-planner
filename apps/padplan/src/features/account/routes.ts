import { Duration, Effect, Option } from "effect"
import { Cookies, Headers, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http"
import { Accounts } from "./AccountRepo.ts"
import { Oidc } from "./Oidc.ts"
import { LOGIN_COOKIE, SESSION_COOKIE, sessionToken } from "./Viewer.ts"

export type CookiePolicy = { readonly secure: boolean; readonly redirectUri: URL }

const attemptCookie = (policy: CookiePolicy) =>
  ({ httpOnly: true, sameSite: "lax", secure: policy.secure, path: "/auth", maxAge: Duration.minutes(10) }) as const

const text = (message: string, status: number) => Effect.succeed(HttpServerResponse.text(message, { status }))

const login = Effect.fn("Auth.login")(function* (policy: CookiePolicy) {
  const oidc = yield* Oidc
  const attempt = yield* oidc.begin
  return yield* HttpServerResponse.redirect(attempt.url).pipe(
    HttpServerResponse.setCookie(LOGIN_COOKIE, attempt.state, attemptCookie(policy))
  )
})

const callback = Effect.fn("Auth.callback")(function* (policy: CookiePolicy) {
  const request = yield* HttpServerRequest.HttpServerRequest
  const oidc = yield* Oidc
  const accounts = yield* Accounts
  const state = Headers.get(request.headers, "cookie").pipe(
    Option.flatMap((header) => Option.fromNullishOr(Cookies.parseHeader(header)[LOGIN_COOKIE]))
  )
  if (Option.isNone(state)) return HttpServerResponse.text("Sign-in expired. Please start again.", { status: 400 })
  const { subject } = yield* oidc.complete(state.value, new URL(request.url, policy.redirectUri))
  const user = yield* accounts.provision(subject).pipe(Effect.orDie)
  const token = yield* accounts.issueSession(user.id).pipe(Effect.orDie)
  return yield* HttpServerResponse.redirect("/").pipe(
    HttpServerResponse.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: policy.secure,
      path: "/",
      maxAge: Duration.days(30)
    }),
    Effect.flatMap(HttpServerResponse.expireCookie(LOGIN_COOKIE, { path: "/auth" }))
  )
})

const logout = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const accounts = yield* Accounts
  const token = sessionToken(request.headers)
  if (Option.isSome(token)) yield* accounts.endSession(token.value).pipe(Effect.orDie)
  return yield* HttpServerResponse.redirect("/").pipe(HttpServerResponse.expireCookie(SESSION_COOKIE, { path: "/" }))
}).pipe(Effect.withSpan("Auth.logout"))

export const signInRoutes = (policy: CookiePolicy) =>
  HttpRouter.use(
    Effect.fnUntraced(function* (router) {
      const context = yield* Effect.context<Oidc | Accounts>()
      yield* router.add(
        "GET",
        "/auth/login",
        login(policy).pipe(
          Effect.catchTag("OidcError", (error) => text(error.message, 503)),
          Effect.provideContext(context)
        )
      )
      yield* router.add(
        "GET",
        "/auth/callback",
        callback(policy).pipe(
          Effect.catchTag("OidcError", (error) => text(error.message, 400)),
          Effect.provideContext(context)
        )
      )
      yield* router.add("POST", "/auth/logout", logout.pipe(Effect.provideContext(context)))
    })
  )

export const signInUnavailable = HttpRouter.use(
  Effect.fnUntraced(function* (router) {
    yield* router.add("GET", "/auth/login", text("Sign-in isn't set up on this server.", 503))
  })
)
