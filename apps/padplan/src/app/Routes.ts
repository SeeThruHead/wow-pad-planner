import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/http"
import { RpcSerialization, RpcServer } from "effect/rpc"
import { viewerRpcLayer } from "../features/account/Viewer.ts"
import { RpcHandlers } from "./Handlers.ts"
import { Rpcs } from "./Rpcs.ts"

const Health = HttpRouter.add("GET", "/healthz", Effect.succeed(HttpServerResponse.text("ok")))

const Rpc = RpcServer.layerHttp({ group: Rpcs, path: "/rpc", protocol: "http" }).pipe(
  Layer.provide([RpcHandlers, viewerRpcLayer, RpcSerialization.layerNdjson])
)

export const Routes = Layer.mergeAll(Health, Rpc)
