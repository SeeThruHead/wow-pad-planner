import { Context, Effect, Layer, Option } from "effect"
import { RpcMiddleware } from "effect/rpc"
import { Forbidden } from "./Admin.ts"
import type { Grant } from "./Admin.ts"
import { Tokens, bearerToken } from "./TokenRepo.ts"

export class AdminGrant extends Context.Service<AdminGrant, Grant>()("padplan/features/admin/AdminGrant") {}

export class AdminRpc extends RpcMiddleware.Service<AdminRpc, { provides: AdminGrant }>()(
  "padplan/features/admin/AdminRpc",
  { error: Forbidden }
) {}

const needsAdminToken = new Forbidden({ message: "Send an admin token as Authorization: Bearer <token>." })

export const adminRpcLayer = Layer.effect(
  AdminRpc,
  Effect.gen(function* () {
    const tokens = yield* Tokens

    const adminGrantOf = Effect.fnUntraced(function* (token: string) {
      const grant = yield* tokens.authenticate(token).pipe(Effect.orDie)
      if (Option.isNone(grant)) return yield* needsAdminToken
      if (grant.value.role === "user") return yield* needsAdminToken
      return grant.value
    })

    return AdminRpc.of(
      Effect.fnUntraced(function* (effect, { headers }) {
        const token = bearerToken(headers)
        if (Option.isNone(token)) return yield* needsAdminToken
        const grant = yield* adminGrantOf(token.value)
        return yield* Effect.provideService(effect, AdminGrant, grant)
      })
    )
  })
)

export const requireSuper = Effect.gen(function* () {
  const grant = yield* AdminGrant
  if (grant.role !== "super") return yield* new Forbidden({ message: "Only the super admin token can do this." })
  return grant
})
