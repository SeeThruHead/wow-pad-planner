import { Effect } from "effect"
import { me, setNickname } from "../features/account/handlers.ts"
import { myLayouts, saveLayout } from "../features/layouts/handlers.ts"
import { Rpcs } from "./Rpcs.ts"

export const RpcHandlers = Rpcs.toLayer(
  Effect.succeed({
    Me: () => me,
    SetNickname: ({ nickname }) => setNickname(nickname),
    MyLayouts: () => myLayouts,
    SaveLayout: ({ layout }) => saveLayout(layout)
  })
)
