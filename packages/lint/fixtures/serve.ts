import { Layer } from "effect"
import { HttpRouter } from "effect/http"
export const loud = HttpRouter.serve(Layer.empty)
export const quiet = HttpRouter.serve(Layer.empty, { disableLogger: true })
export const alsoLoud = HttpRouter.toWebHandler(Layer.empty, { disableLogger: false })
