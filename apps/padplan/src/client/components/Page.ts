import type { Html, HtmlBuilder } from "foldkit/html"
import { slotTitle } from "../../domain/Layout.ts"
import { Hud } from "./Hud.ts"
import { AccountBar, Controls, Editor, GetItIntoWow, HowTo, Palette, Sharing, Steam, Why } from "./Panels.ts"
import { TipView, tipFor } from "./Tip.ts"
import { currentCharacter, currentLayout, currentPlan } from "../app/library.ts"
import { CharacterSelect } from "./CharacterSelect.ts"
import { DialogView } from "./Dialog.ts"
import type { Message } from "../app/messages.ts"
import type { Model } from "../app/model.ts"

export const Page = (model: Model, h: HtmlBuilder<Message>): Html => {
  const character = currentCharacter(model)
  const layout = currentLayout(model)
  const plan = currentPlan(model)
  const hud = Hud(h, plan, {
    selected: model.selected,
    label: (location, described) => slotTitle(plan, location, described)
  })
  const planner = character && layout
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
              "Plan WoW Forever's gamepad bars for each of your characters, then put the layout in the game with the PadPlan addon. ",
              h.a([h.Href("https://github.com/SeeThruHead/wow-pad-planner")], ["Source and addon"])
            ]
          ),
          AccountBar(h, model)
        ]
      ),
      planner
        ? h.main(
            [],
            [
              h.section(
                [],
                [
                  HowTo(h),
                  Editor(h, model, character, layout, plan, hud),
                  GetItIntoWow(h, model),
                  Sharing(h, model),
                  Why(h, plan),
                  Controls(h, plan),
                  Steam(h, plan)
                ]
              ),
              Palette(h, model, plan)
            ]
          )
        : h.main(
            [h.Class("single")],
            [h.section([], [HowTo(h), CharacterSelect(h, model.library.characters), Sharing(h, model)])]
          ),
      ...DialogView(h, model.dialog),
      h.div([h.Class(model.toast ? "toast show" : "toast"), h.Id("toast")], [model.toast ?? ""]),
      TipView(h, model.hovered ? tipFor(plan, model.hovered) : null, model.tip)
    ]
  )
}
