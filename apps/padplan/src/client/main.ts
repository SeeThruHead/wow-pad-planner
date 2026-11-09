import "./base.css"
import { Layer } from "effect"
import { FetchHttpClient } from "effect/http"
import { Runtime } from "foldkit"
import { ApiClient } from "./api/ApiClient.ts"
import * as Commands from "./app/commands.ts"
import { emptyLibrary } from "./app/library.ts"
import { Message } from "./app/messages.ts"
import { Model } from "./app/model.ts"
import { update } from "./app/update.ts"
import { view } from "./app/view.ts"

Runtime.run(
  Runtime.makeApplication({
    Model,
    init: () => ({
      model: {
        library: emptyLibrary("local"),
        builtinSets: {},
        selected: null,
        picked: null,
        dragging: null,
        search: "",
        hovered: null,
        tip: null,
        toast: null,
        codeText: null,
        importOpen: false,
        importText: "",
        account: { _tag: "Unknown" as const },
        clock: 0,
        nicknameDraft: ""
      },
      commands: [Commands.LoadLibrary()]
    }),
    update,
    view: (model, h) => ({ title: "WoW Forever gamepad bar planner", body: view(model, h) }),
    devTools: { Message },
    container: document.getElementById("app"),
    resources: ApiClient.over(globalThis.location.origin).pipe(Layer.provide(FetchHttpClient.layer))
  })
)
