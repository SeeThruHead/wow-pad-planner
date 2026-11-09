import type { Html, HtmlBuilder } from "foldkit/html"
import { classCatalog } from "../../domain/Catalog.ts"
import type { Character } from "../../domain/Character.ts"
import { Message } from "../app/messages.ts"
import type { Message as AppMessage } from "../app/messages.ts"

type H = HtmlBuilder<AppMessage>

const card = (h: H, character: Character): Html => {
  const data = classCatalog(character.className)
  const layouts = character.layouts.length
  return h.div(
    [h.Class("character-card"), h.OnClick(Message.OpenedCharacter({ id: character.id }))],
    [
      h.div([h.Class("character-card-name"), h.Style({ color: data.color })], [character.name]),
      h.div([h.Class("character-card-line")], [`Level ${character.level} ${data.name}`]),
      h.div([h.Class("character-card-line sub")], [character.realm || "No realm set"]),
      h.div([h.Class("character-card-line sub")], [`${layouts} layout${layouts === 1 ? "" : "s"}`]),
      h.button(
        [h.Class("character-card-edit"), h.OnClick(Message.ClickedRenameCharacter({ id: character.id }))],
        ["Edit"]
      )
    ]
  )
}

export const CharacterSelect = (h: H, characters: ReadonlyArray<Character>): Html =>
  h.div(
    [h.Class("panel character-select"), h.Id("character-select")],
    [
      h.h2([], ["Your characters"]),
      h.p(
        [h.Class("sub")],
        [
          "Each character keeps its own layouts. Pick one to plan its bars, or create one for each character you play. Use the name and realm the character has in WoW, so PadPlan finds it."
        ]
      ),
      h.div(
        [h.Class("character-grid")],
        [
          ...characters.map((character) => card(h, character)),
          h.button(
            [h.Class("character-card new"), h.Id("new-character"), h.OnClick(Message.ClickedNewCharacter())],
            ["+ Create character"]
          )
        ]
      )
    ]
  )
