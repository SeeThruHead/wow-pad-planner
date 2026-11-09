import type { Html, HtmlBuilder } from "foldkit/html"
import { describe, slotTitle } from "../../domain/Layout.ts"
import { Hud } from "./Hud.ts"
import { AccountBar, Controls, Editor, GetItIntoWow, HowTo, Palette, Sharing, Steam, Why } from "./Panels.ts"
import { TipView, tipFor } from "./Tip.ts"
import { currentPlan } from "../app/library.ts"
import type { Message } from "../app/messages.ts"
import type { Model } from "../app/model.ts"

export const Page = (model: Model, h: HtmlBuilder<Message>): Html => {
  const plan = currentPlan(model)
  const hud = Hud(h, plan, {
    selected: model.selected,
    label: (location, described) => {
      const title = slotTitle(plan, location, described ?? describe(plan, undefined))
      return title
    }
  })
  return h.div(
    [],
    [
      h.header(
        [],
        [
          h.h1([], ["Gamepad bar planner"]),
          h.span(
            [h.Class("sub")],
            [
              "Plan WoW Forever's gamepad bars for any class and controller, then put the layout in the game with the PadPlan addon. Your layouts are saved in this browser. ",
              h.a([h.Href("https://github.com/SeeThruHead/wow-pad-planner")], ["Source and addon"])
            ]
          ),
          AccountBar(h, model)
        ]
      ),
      h.main(
        [],
        [
          h.section(
            [],
            [
              HowTo(h),
              Editor(h, model, plan, hud),
              GetItIntoWow(h, model),
              Sharing(h, model),
              Why(h, plan),
              Controls(h, plan),
              Steam(h, plan)
            ]
          ),
          Palette(h, model, plan)
        ]
      ),
      h.div([h.Class(model.toast ? "toast show" : "toast"), h.Id("toast")], [model.toast ?? ""]),
      TipView(h, model.hovered ? tipFor(plan, model.hovered) : null, model.tip)
    ]
  )
}
