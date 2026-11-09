import { Context, Layer } from "effect"
import type { HttpClient } from "effect/http"
import { RpcClient, RpcSerialization } from "effect/rpc"
import type { RpcClientError } from "effect/rpc"
import { Rpcs } from "../../app/Rpcs.ts"

export type Client = RpcClient.FromGroup<typeof Rpcs, RpcClientError.RpcClientError>

export class ApiClient extends Context.Service<ApiClient, Client>()("padplan/client/ApiClient") {
  static readonly over = (origin: string): Layer.Layer<ApiClient, never, HttpClient.HttpClient> =>
    Layer.effect(ApiClient, RpcClient.make(Rpcs)).pipe(
      Layer.provide(RpcClient.layerProtocolHttp({ url: `${origin}/rpc` })),
      Layer.provide(RpcSerialization.layerNdjson)
    )
}
