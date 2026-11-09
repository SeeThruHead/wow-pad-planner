import { Clock, Context, Effect, HashMap, Layer, Option, Redacted, Ref, Schema } from "effect"
import { Digest, SecureRandom } from "effect/crypto"
import { Base64Url } from "effect/encoding"
import * as client from "openid-client"

export const OidcConfig = Schema.Struct({
  issuer: Schema.URL,
  clientId: Schema.NonEmptyString,
  clientSecret: Schema.Redacted(Schema.NonEmptyString),
  redirectUri: Schema.URL
})
export type OidcConfig = typeof OidcConfig.Type

export class OidcError extends Schema.TaggedError<OidcError, { readonly brand: unique symbol }>()("OidcError", {
  message: Schema.String
}) {}

const Claims = Schema.Struct({ sub: Schema.NonEmptyString })

type Attempt = { readonly verifier: string; readonly nonce: string; readonly expiresAt: number }

const failed = () => new OidcError({ message: "Pocket ID login failed. Please start again." })

const random = Effect.gen(function* () {
  const secure = yield* SecureRandom.SecureRandom
  const bytes = yield* secure.randomBytes(32)
  return Base64Url.encode(bytes)
})

export class Oidc extends Context.Service<
  Oidc,
  {
    readonly begin: Effect.Effect<{ readonly state: string; readonly url: string }, OidcError>
    complete(state: string, callbackUrl: URL): Effect.Effect<{ readonly subject: string }, OidcError>
  }
>()("padplan/features/account/Oidc") {
  static readonly layer = (
    config: OidcConfig,
    options?: Pick<client.DiscoveryRequestOptions, typeof client.customFetch>
  ) =>
    Layer.effect(
      Oidc,
      Effect.gen(function* () {
        const pending = yield* Ref.make(HashMap.empty<string, Attempt>())
        const context = yield* Effect.context<SecureRandom.SecureRandom | Digest.Digest>()
        const discovery = yield* Effect.tryPromise({
          try: () =>
            client.discovery(config.issuer, config.clientId, Redacted.value(config.clientSecret), undefined, {
              ...options,
              timeout: 10
            }),
          catch: failed
        }).pipe(Effect.cachedWithTTL("1 hour"))

        const begin = Effect.gen(function* () {
          const provider = yield* discovery
          const state = yield* random
          const verifier = yield* random
          const nonce = yield* random
          const now = yield* Clock.currentTimeMillis
          const digests = yield* Digest.Digest
          const hashed = yield* digests.digest(Digest.sha256, new TextEncoder().encode(verifier))
          const challenge = Base64Url.encode(hashed)
          yield* Ref.update(pending, (attempts) =>
            HashMap.set(
              HashMap.filter(attempts, (attempt) => attempt.expiresAt > now),
              state,
              { verifier, nonce, expiresAt: now + 600_000 }
            )
          )
          const url = client.buildAuthorizationUrl(provider, {
            redirect_uri: config.redirectUri.href,
            scope: "openid profile",
            code_challenge: challenge,
            code_challenge_method: "S256",
            state,
            nonce
          })
          return { state, url: url.href }
        }).pipe(Effect.provideContext(context), Effect.withSpan("Oidc.begin"))

        const complete = Effect.fn("Oidc.complete")(function* (state: string, callbackUrl: URL) {
          const attempt = yield* Ref.modify(
            pending,
            (attempts) => [HashMap.get(attempts, state), HashMap.remove(attempts, state)] as const
          )
          if (Option.isNone(attempt)) return yield* failed()
          const now = yield* Clock.currentTimeMillis
          if (attempt.value.expiresAt <= now) return yield* failed()
          const provider = yield* discovery
          const tokens = yield* Effect.tryPromise({
            try: () =>
              client.authorizationCodeGrant(provider, callbackUrl, {
                pkceCodeVerifier: attempt.value.verifier,
                expectedState: state,
                expectedNonce: attempt.value.nonce,
                idTokenExpected: true
              }),
            catch: failed
          })
          const claims = yield* Schema.decodeUnknownEffect(Claims)(tokens.claims()).pipe(Effect.mapError(failed))
          return { subject: `${config.issuer.href}|${claims.sub}` }
        })

        return Oidc.of({ begin, complete })
      })
    )
}
