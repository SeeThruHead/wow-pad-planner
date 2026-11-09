import type { Html, HtmlBuilder } from "foldkit/html"
import { catalog } from "../../domain/Catalog.ts"
import { STARTERS } from "../../domain/Starters.ts"
import { Message } from "../app/messages.ts"
import type { Message as AppMessage } from "../app/messages.ts"
import type { Dialog as DialogModel } from "../app/model.ts"

type H = HtmlBuilder<AppMessage>
type Field = "name" | "className" | "level" | "realm" | "start"

const changed = (field: Field) => (value: string) => Message.ChangedDialog({ field, value })

const text = (h: H, label: string, id: string, field: Field, value: string, placeholder: string): Html =>
  h.label(
    [h.Class("dialog-field")],
    [label, h.input([h.Type("text"), h.Id(id), h.Value(value), h.Placeholder(placeholder), h.OnInput(changed(field))])]
  )

const levelField = (h: H, value: string): Html =>
  h.label(
    [h.Class("dialog-field")],
    [
      "Level",
      h.input([
        h.Type("number"),
        h.Id("dialog-level"),
        h.Min("1"),
        h.Max("60"),
        h.Value(value),
        h.OnInput(changed("level"))
      ])
    ]
  )

const classField = (h: H, value: string): Html =>
  h.label(
    [h.Class("dialog-field")],
    [
      "Class",
      h.select(
        [h.Id("dialog-class"), h.OnChange(changed("className"))],
        Object.entries(catalog.classes).map(([key, data]) =>
          h.option([h.Value(key), h.Selected(key === value)], [data.name])
        )
      )
    ]
  )

const startField = (h: H, dialog: DialogModel): Html =>
  h.label(
    [h.Class("dialog-field")],
    [
      "Start from",
      h.select(
        [h.Id("dialog-start"), h.OnChange(changed("start"))],
        [
          h.option([h.Value(""), h.Selected(dialog.start === "")], ["Blank"]),
          ...STARTERS.filter((starter) => starter.plan.class === dialog.className).map((starter) =>
            h.option([h.Value(starter.id), h.Selected(starter.id === dialog.start)], [starter.plan.name])
          )
        ]
      )
    ]
  )

const TITLES: Readonly<Record<DialogModel["kind"], string>> = {
  newCharacter: "Create a character",
  renameCharacter: "Edit character",
  newLayout: "New layout"
}

const fields = (h: H, dialog: DialogModel): ReadonlyArray<Html> => {
  if (dialog.kind === "newLayout") {
    return [text(h, "Name", "dialog-name", "name", dialog.name, "Leveling, Dungeons, PvP..."), startField(h, dialog)]
  }
  return [
    text(h, "Name (as in WoW)", "dialog-name", "name", dialog.name, "Mimesis"),
    ...(dialog.kind === "newCharacter" ? [classField(h, dialog.className)] : []),
    levelField(h, dialog.level),
    text(h, "Realm (optional)", "dialog-realm", "realm", dialog.realm, "Seethruhead")
  ]
}

export const DialogView = (h: H, dialog: DialogModel | null): ReadonlyArray<Html> =>
  dialog === null
    ? []
    : [
        h.div(
          [h.Class("dialog-backdrop")],
          [
            h.div(
              [h.Class("panel dialog"), h.Id("dialog"), h.Role("dialog"), h.AriaLabel(TITLES[dialog.kind])],
              [
                h.h2([], [TITLES[dialog.kind]]),
                ...fields(h, dialog),
                h.div(
                  [h.Class("toolbar dialog-actions")],
                  [
                    h.button(
                      [h.Class("on"), h.Id("dialog-confirm"), h.OnClick(Message.ClickedConfirmDialog())],
                      [dialog.kind === "renameCharacter" ? "Save" : "Create"]
                    ),
                    h.button([h.Id("dialog-cancel"), h.OnClick(Message.ClickedCancelDialog())], ["Cancel"]),
                    ...(dialog.kind === "renameCharacter"
                      ? [
                          h.button(
                            [
                              h.Class("danger"),
                              h.Id("dialog-delete"),
                              h.OnClick(Message.ClickedDeleteCharacter({ id: dialog.start }))
                            ],
                            ["Delete character"]
                          )
                        ]
                      : [])
                  ]
                )
              ]
            )
          ]
        )
      ]
