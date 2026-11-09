import type { Attribute, Html, HtmlBuilder } from "foldkit/html"
import { catalog, classCatalog } from "../../domain/Catalog.ts"
import type { Spell } from "../../domain/Catalog.ts"
import { CONTROLLERS, FREE_KEYS, backLabel } from "../../domain/Controllers.ts"
import {
  backNeeds,
  controlRows,
  controllerOf,
  describe,
  slotInfoText,
  slotTitle,
  steamSteps,
  unpickableKeys,
  usedCounts,
  usesBack
} from "../../domain/Layout.ts"
import { ControllerId, entryAt } from "../../domain/Plan.ts"
import type { Autoload, Character, NamedLayout } from "../../domain/Character.ts"
import type { Plan, SlotLocation } from "../../domain/Plan.ts"
import { Message } from "../app/messages.ts"
import type { Message as AppMessage } from "../app/messages.ts"
import type { Model } from "../app/model.ts"

type H = HtmlBuilder<AppMessage>

const RELEASES = "https://github.com/SeeThruHead/wow-pad-planner/releases/latest"
const BACKHAND = "https://www.curseforge.com/wow/addons/snrn-backhand"

const tipButton = (
  h: H,
  id: string,
  label: string,
  message: AppMessage,
  extra: ReadonlyArray<Attribute<AppMessage>> = []
) =>
  h.button(
    [
      h.Id(id),
      h.DataAttribute("tip-id", `button:${id}`),
      h.OnMouseEnter(Message.HoveredTip({ target: `button:${id}` })),
      h.OnMouseLeave(Message.LeftTip()),
      h.OnClick(message),
      ...extra
    ],
    [label]
  )

const isController = (value: string): value is ControllerId =>
  ControllerId.literals.some((literal) => literal === value)

export const HowTo = (h: H): Html =>
  h.details(
    [h.Class("panel howto"), h.Open(true)],
    [
      h.summary([], ["How to use this"]),
      h.ol(
        [],
        [
          h.li(
            [],
            [
              h.strong([], ["Pick or create a character"]),
              ", with its name, class, level and realm as in WoW. Each character has its own layouts as tabs (Leveling, Dungeons...); the \u2605 one is the one PadPlan puts on your bars."
            ]
          ),
          h.li(
            [],
            [
              h.strong([], ["Drag spells"]),
              " from the list on the right onto the slots. The picture is drawn like the game's: the middle cluster is what you get with no trigger held, the left one with LT held, the right one with RT, the bottom one with both. Hover anything to see what it is."
            ]
          ),
          h.li(
            [],
            [
              h.strong([], ["Back buttons (optional):"]),
              ' tick "Back buttons" to use your controller\'s back buttons as more slots. This needs the free SNRN Backhand addon.'
            ]
          ),
          h.li(
            [],
            [
              h.strong([], ["Get it into WoW:"]),
              ' install the PadPlan addon, give it this layout (a file or a code), then log in. It puts everything in place by itself. See "Get it into WoW" below.'
            ]
          ),
          h.li(
            [],
            [
              h.strong([], ["Steam:"]),
              ' if you use back buttons, set them up in Steam as the "Steam Input" steps below say.'
            ]
          )
        ]
      )
    ]
  )

const banner = (h: H, plan: Plan): ReadonlyArray<Html> => {
  const bad = unpickableKeys(plan)
  if (bad.length === 0) return []
  return [
    h.div(
      [h.Class("banner"), h.Id("banner")],
      [
        h.div(
          [],
          [
            `This layout has back buttons on keys Steam's keyboard can't send (${bad.map(([id, key]) => `${id} ${key}`).join(", ")}). `,
            h.button([h.Id("fix-keys"), h.OnClick(Message.ClickedFixKeys())], ["Use F9 to F12 instead"])
          ]
        )
      ]
    )
  ]
}

const AUTOLOAD_LABELS: ReadonlyArray<readonly [Autoload, string]> = [
  ["ask", "Ask me at login"],
  ["auto", "Apply automatically"],
  ["off", "Off (apply by hand)"]
]

const isAutoload = (value: string): value is Autoload => AUTOLOAD_LABELS.some(([key]) => key === value)

const characterBar = (h: H, character: Character): Html =>
  h.div(
    [h.Class("toolbar character-bar")],
    [
      h.button([h.Id("characters"), h.OnClick(Message.ClickedCharacters())], ["\u2190 Characters"]),
      h.strong(
        [h.Class("character-name"), h.Style({ color: classCatalog(character.className).color })],
        [character.name]
      ),
      h.span(
        [h.Class("sub")],
        [`${classCatalog(character.className).name}${character.realm ? `, ${character.realm}` : ""}`]
      ),
      h.label(
        [h.Class("sub")],
        [
          "Level ",
          h.input([
            h.Type("number"),
            h.Id("level"),
            h.Min("1"),
            h.Max("60"),
            h.Style({ width: "62px" }),
            h.Value(String(character.level)),
            h.OnChange((level) => Message.ChangedCharacterLevel({ level }))
          ])
        ]
      ),
      h.button(
        [h.Id("edit-character"), h.OnClick(Message.ClickedRenameCharacter({ id: character.id }))],
        ["Edit character"]
      )
    ]
  )

const tabs = (h: H, character: Character, layout: NamedLayout): Html =>
  h.div(
    [h.Class("toolbar tabs"), h.Id("tabs")],
    [
      ...character.layouts.map((item) =>
        h.button(
          [h.Class(item.id === layout.id ? "tab on" : "tab"), h.OnClick(Message.PickedTab({ id: item.id }))],
          [item.id === character.activeLayoutId ? `\u2605 ${item.name}` : item.name]
        )
      ),
      tipButton(h, "new-layout", "+ New layout", Message.ClickedNewLayout())
    ]
  )

const layoutActions = (h: H, character: Character, layout: NamedLayout): Html =>
  h.div(
    [h.Class("toolbar")],
    [
      h.input([
        h.Type("text"),
        h.Id("layout-name"),
        h.Title("Layout name"),
        h.Style({ width: "200px" }),
        h.Value(layout.name),
        h.OnChange((name) => Message.RenamedLayout({ name }))
      ]),
      tipButton(h, "duplicate", "Duplicate", Message.ClickedDuplicateLayout()),
      tipButton(h, "delete", "Delete", Message.ClickedDeleteLayout(), [h.Disabled(character.layouts.length < 2)]),
      layout.id === character.activeLayoutId
        ? h.span([h.Class("active-note")], ["\u2605 Used in WoW"])
        : tipButton(h, "make-active", "Use this one in WoW", Message.ClickedMakeActive()),
      h.label(
        [h.Class("sub")],
        [
          "In WoW: ",
          h.select(
            [
              h.Id("autoload"),
              h.OnChange((value) =>
                isAutoload(value) ? Message.ChangedAutoload({ autoload: value }) : Message.SavedLocally()
              )
            ],
            AUTOLOAD_LABELS.map(([key, label]) =>
              h.option([h.Value(key), h.Selected((character.autoload ?? "ask") === key)], [label])
            )
          )
        ]
      )
    ]
  )

const setsToolbar = (h: H, plan: Plan): Html => {
  const names = controllerOf(plan).names
  return h.div(
    [h.Class("toolbar"), h.Id("sets")],
    [
      ...plan.sets.map((set, index) =>
        h.button(
          [h.Class(index === plan.activeSet ? "on" : ""), h.OnClick(Message.PickedSet({ index }))],
          [`Set ${index + 1}: ${set.name}`]
        )
      ),
      h.input([
        h.Type("text"),
        h.Value((plan.sets[plan.activeSet] ?? plan.sets[0]).name),
        h.Title("Name of this set"),
        h.Style({ width: "150px" }),
        h.OnChange((name) => Message.RenamedSet({ name }))
      ]),
      h.span([h.Class("sub")], [`${names.lb} + ${names.rb} + d-pad left/right switches set in game.`])
    ]
  )
}

const backRow = (h: H, plan: Plan, id: string): Html => {
  const setting = plan.back[id] ?? { use: "slot" as const, key: "F9", note: "" }
  return h.div(
    [h.Class("back-row")],
    [
      h.strong([], [backLabel(id)]),
      h.select(
        [
          h.DataAttribute("field", "use"),
          h.OnChange((value) => Message.ChangedBackUse({ id, use: value === "other" ? "other" : "slot" }))
        ],
        [
          h.option([h.Value("slot"), h.Selected(setting.use === "slot")], ["Spell slots"]),
          h.option([h.Value("other"), h.Selected(setting.use === "other")], ["Used by something else"])
        ]
      ),
      h.label(
        [h.Class("sub")],
        [
          setting.use === "other" ? "Sends " : "Steam key ",
          h.select(
            [h.DataAttribute("field", "key"), h.OnChange((key) => Message.ChangedBackKey({ id, key }))],
            [
              h.option([h.Value(""), h.Selected(setting.key === "")], ["none"]),
              ...FREE_KEYS.map((key) => h.option([h.Value(key), h.Selected(key === setting.key)], [key]))
            ]
          )
        ]
      ),
      ...(setting.use === "other"
        ? [
            h.input([
              h.Type("text"),
              h.DataAttribute("field", "note"),
              h.Placeholder("What uses it"),
              h.Value(setting.note),
              h.OnChange((note) => Message.ChangedBackNote({ id, note }))
            ])
          ]
        : [])
    ]
  )
}

const backSection = (h: H, plan: Plan): ReadonlyArray<Html> =>
  usesBack(plan)
    ? [
        h.div(
          [h.Id("back")],
          [
            h.h2([h.Style({ "margin-top": "14px" })], ["Back buttons"]),
            h.p(
              [h.Class("layer-hint"), h.Style({ "margin-top": "0" })],
              [
                "Each back button is an extra slot on every trigger layer, drawn as the round 2 x 2 grid above each cluster, the way it looks in game. They're the same in all three sets. Mark a button as used by something else to keep it free."
              ]
            ),
            h.div(
              [h.Class("needs")],
              [
                h.strong([], ["What you need"]),
                h.ol(
                  [h.Id("back-needs")],
                  backNeeds(plan).map((text) => h.li([], [text]))
                )
              ]
            ),
            h.div(
              [h.Id("back-settings")],
              controllerOf(plan).back.map((id) => backRow(h, plan, id))
            ),
            h.div(
              [h.Class("toolbar"), h.Style({ "margin-top": "8px" })],
              [tipButton(h, "mirror", "Copy the d-pad onto the back buttons", Message.ClickedMirror())]
            )
          ]
        )
      ]
    : []

const details = (h: H, model: Model, plan: Plan): Html => {
  const location: SlotLocation | null = model.selected
  if (location === null) {
    return h.div(
      [h.Class("details"), h.Id("details")],
      model.picked
        ? [h.p([h.Class("sub")], ["Picked ", h.strong([], [model.picked]), ": click a slot to put it there."])]
        : []
    )
  }
  const described = describe(plan, entryAt(plan, location))
  const body =
    described === undefined
      ? []
      : described.kind === "custom"
        ? [
            h.div(
              [h.Class("row")],
              [
                h.label(
                  [h.Class("sub")],
                  [
                    "Label ",
                    h.input([
                      h.Type("text"),
                      h.Id("custom-label"),
                      h.Value(described.name),
                      h.OnChange((label) => Message.ChangedCustomLabel({ label }))
                    ])
                  ]
                )
              ]
            ),
            h.div([h.Class("sub")], ["Macro text (leave it empty for a reminder that isn't placed in game):"]),
            h.textarea([
              h.Id("custom-body"),
              h.Value(described.body),
              h.OnChange((text) => Message.ChangedCustomBody({ body: text }))
            ])
          ]
        : [
            h.div(
              [h.Class("desc")],
              [
                described.kind === "spell"
                  ? `${described.spell.level ? `Level ${described.spell.level}. ` : ""}${described.spell.talent ? "Talent. " : ""}${described.spell.desc}`
                  : "Not in this class's spell list. "
              ]
            )
          ]
  return h.div(
    [h.Class("details"), h.Id("details")],
    [
      h.div(
        [h.Class("row")],
        [
          h.span([h.Class("what")], [slotTitle(plan, location, described)]),
          h.button([h.Id("clear-slot"), h.OnClick(Message.ClearedSelectedSlot())], ["Empty"]),
          h.button([h.Id("custom-slot"), h.OnClick(Message.MadeSelectedCustom())], ["Make custom"])
        ]
      ),
      h.div([h.Class("desc")], [slotInfoText(plan, location)]),
      ...body
    ]
  )
}

const offerPanel = (h: H, model: Model): ReadonlyArray<Html> => {
  const offer = model.offer
  if (offer === null) return []
  const title = offer.kind === "optimize" ? "Optimize for back buttons?" : "Keep the back-button spells?"
  const intro =
    offer.kind === "optimize"
      ? "This controller has back buttons. PadPlan can move the spells you press most onto them, so they need no trigger, and free those trigger + face buttons. B stays as it is on every layer. Nothing is removed."
      : "This controller has no back buttons, so the spells on them would not be reachable. PadPlan can move each one to a free slot (set 1 first, then set 2), so nothing disappears."
  return [
    h.div(
      [h.Class("banner offer"), h.Id("offer")],
      [
        h.strong([], [title]),
        h.p([], [intro]),
        h.ul(
          [h.Id("offer-moves")],
          offer.moves.map((move) => h.li([], [`${move.name}: ${move.from} \u2192 ${move.to}`]))
        ),
        h.div(
          [h.Class("toolbar")],
          [
            h.button([h.Class("on"), h.Id("offer-yes"), h.OnClick(Message.AcceptedOffer())], ["Yes, in a new tab"]),
            h.button([h.Id("offer-no"), h.OnClick(Message.DismissedOffer())], ["No thanks"]),
            h.span([h.Class("sub")], ["The current layout stays as it is."])
          ]
        )
      ]
    )
  ]
}

const rearrangedNote = (h: H, model: Model, layout: NamedLayout): ReadonlyArray<Html> =>
  model.rearranged !== null && model.rearranged.layoutId === layout.id
    ? [
        h.div(
          [h.Class("banner"), h.Id("rearranged")],
          [
            h.div(
              [],
              [
                "This tab is the rearranged copy; the original tab is unchanged. ",
                h.button([h.Id("undo-rearrange"), h.OnClick(Message.UndidRearrange())], ["Undo"])
              ]
            )
          ]
        )
      ]
    : []

export const Editor = (h: H, model: Model, character: Character, layout: NamedLayout, plan: Plan, hud: Html): Html =>
  h.div(
    [h.Class("panel")],
    [
      characterBar(h, character),
      tabs(h, character, layout),
      layoutActions(h, character, layout),
      ...banner(h, plan),
      ...offerPanel(h, model),
      ...rearrangedNote(h, model, layout),
      h.div(
        [h.Class("toolbar")],
        [
          h.label(
            [h.Class("sub")],
            [
              "Controller ",
              h.select(
                [
                  h.Id("controller-pick"),
                  h.OnChange((value) =>
                    isController(value) ? Message.PickedController({ controller: value }) : Message.SavedLocally()
                  )
                ],
                Object.entries(CONTROLLERS).map(([key, data]) =>
                  h.option([h.Value(key), h.Selected(key === plan.controller)], [data.name])
                )
              )
            ]
          )
        ]
      ),
      setsToolbar(h, plan),
      h.div(
        [h.Class("toolbar")],
        [
          h.label(
            [
              h.Class("toggle"),
              h.Id("use-back-label"),
              h.DataAttribute("tip-id", "button:use-back"),
              h.OnMouseEnter(Message.HoveredTip({ target: "button:use-back" })),
              h.OnMouseLeave(Message.LeftTip())
            ],
            [
              h.input([
                h.Type("checkbox"),
                h.Id("use-back"),
                h.Checked(usesBack(plan)),
                h.Disabled(controllerOf(plan).back.length === 0),
                h.OnChange(() => Message.ToggledBackButtons({ on: !usesBack(plan) }))
              ]),
              " Back buttons (Backhand addon)"
            ]
          ),
          h.span([h.Class("sub")], ["Shows the back-button slots in the picture."])
        ]
      ),
      hud,
      h.p(
        [h.Class("layer-hint")],
        [
          "With no trigger held, the face buttons belong to the game (interact, inspect, back, jump), so they can't hold spells. Drag a spell onto a slot, drag between slots to swap, right-click a slot to empty it. On a touch screen, tap a spell and then a slot; hold a slot or spell to see what it is."
        ]
      ),
      ...backSection(h, plan),
      details(h, model, plan)
    ]
  )

const route = (h: H, button: Html, text: ReadonlyArray<Html | string>) =>
  h.div([h.Class("route")], [button, h.span([], [...text])])

export const GetItIntoWow = (h: H, model: Model): Html =>
  h.div(
    [h.Class("panel notes"), h.Id("wow")],
    [
      h.h2([], ["Get it into WoW"]),
      h.ol(
        [],
        [
          h.li(
            [],
            [
              "Install the PadPlan addon: download ",
              h.a([h.Href(RELEASES)], ["PadPlan.zip"]),
              " and unzip it into ",
              h.code([], ["World of Warcraft/_forever_/Interface/AddOns/"]),
              ". If you use back buttons, install ",
              h.a([h.Href(BACKHAND)], ["SNRN Backhand"]),
              " the same way."
            ]
          ),
          h.li(
            [],
            [
              "Give PadPlan your layouts. There are two ways; pick one.",
              route(h, tipButton(h, "save-wow", "Download PadPlanData.lua", Message.ClickedDownloadLua()), [
                "One small file with the \u2605 active layout of every character here. Put it in ",
                h.code([], ["World of Warcraft/_forever_/Interface/AddOns/PadPlan/"]),
                ", replacing the one there. No typing in game, so it suits playing with only a controller."
              ]),
              route(h, tipButton(h, "addon-code", "Copy layout code", Message.ClickedCopyCode()), [
                "This character's \u2605 active layout as text. Log in on that character, type ",
                h.code([], ["/padplan import"]),
                ", paste it and press Import (needs a keyboard). It only goes to the character you're playing. The same code also works in anyone's planner: Import, then paste."
              ]),
              ...(model.codeText
                ? [
                    h.div(
                      [h.Id("addon-code-box")],
                      [
                        h.textarea([
                          h.Id("addon-code-text"),
                          h.Attribute("readonly", "readonly"),
                          h.Value(model.codeText)
                        ])
                      ]
                    )
                  ]
                : [])
            ]
          ),
          h.li(
            [],
            [
              "Log in. PadPlan finds the character by its name and realm and only ever changes that character's bars; characters it has no layout for are left alone. What happens next is the \"In WoW\" setting above each character's layouts:"
            ]
          ),
          h.li(
            [h.Class("plain")],
            [
              h.strong([], ["Ask me at login"]),
              " (the default): a game window names the character and the layout and asks whether to put it on your bars. Press A for Apply or B for Not now; no mouse needed. ",
              h.strong([], ["Apply automatically"]),
              ": it just does it and says so in chat. ",
              h.strong([], ["Off"]),
              ": it only tells you a layout is waiting; open PadPlan in the addon menu (next to the minimap) and choose Apply layout."
            ]
          ),
          h.li(
            [h.Class("plain")],
            [
              "Before applying, PadPlan backs up the bars and keys it replaces. To go back, open PadPlan in the addon menu and choose Undo last apply. Spells you haven't learned yet go on by themselves when you learn them."
            ]
          )
        ]
      ),
      h.p(
        [h.Class("sub")],
        [
          "Macros in a layout become character macros named ",
          h.code([], ["PP ..."]),
          ", so they need free character macro slots."
        ]
      )
    ]
  )

export const Sharing = (h: H, model: Model): Html =>
  h.div(
    [h.Class("panel notes"), h.Id("sharing")],
    [
      h.h2([], ["Share and back up"]),
      h.p(
        [h.Class("sub")],
        [
          'To share a layout, send its layout code ("Copy layout code" above). Anyone can paste it into this page with Import, or into WoW with ',
          h.code([], ["/padplan import"]),
          "."
        ]
      ),
      route(h, tipButton(h, "import", "Import", Message.ClickedImport()), [
        "Add a layout from a layout code or from an exported file."
      ]),
      route(h, tipButton(h, "export", "Export this layout as a file", Message.ClickedExport()), [
        "Saves this layout as a file you can keep as a backup or send to someone. WoW doesn't read it; Import brings it back."
      ]),
      ...(model.importOpen
        ? [
            h.div(
              [h.Id("share-box")],
              [
                h.textarea([
                  h.Id("share-text"),
                  h.Placeholder("Paste a layout code here"),
                  h.Value(model.importText),
                  h.OnInput((text) => Message.ChangedImportText({ text }))
                ]),
                h.div(
                  [h.Class("toolbar")],
                  [
                    h.button([h.Id("import-code"), h.OnClick(Message.ClickedImportCode())], ["Import this code"]),
                    h.label(
                      [h.Class("button")],
                      [
                        "Import a file instead",
                        h.input([
                          h.Type("file"),
                          h.Id("import-file"),
                          h.Attribute("accept", "application/json,.json"),
                          h.Hidden(true),
                          h.OnFileChange((files) =>
                            files[0] ? Message.PickedImportFile({ file: files[0] }) : Message.SavedLocally()
                          )
                        ])
                      ]
                    )
                  ]
                )
              ]
            )
          ]
        : [])
    ]
  )

export const Why = (h: H, plan: Plan): Html =>
  h.div(
    [h.Class("panel notes")],
    [
      h.h2([], ["Why it's laid out this way"]),
      h.textarea([
        h.Id("why"),
        h.Placeholder("Notes about this layout"),
        h.Value(plan.why),
        h.OnChange((why) => Message.ChangedWhy({ why }))
      ])
    ]
  )

export const Controls = (h: H, plan: Plan): Html =>
  h.div(
    [h.Class("panel controls")],
    [
      h.h2([], ["Every control"]),
      h.label(
        [h.Class("sub"), h.Style({ display: "block", "margin-bottom": "8px" })],
        [
          "Keys other tools send through Steam, such as a voice chat app (comma-separated, like ",
          h.code([], ["Home"]),
          " or ",
          h.code([], ["Ctrl+Shift+F1"]),
          "). PadPlan makes WoW ignore them.",
          h.input([
            h.Type("text"),
            h.Id("other-keys"),
            h.Style({ width: "100%", "margin-top": "4px" }),
            h.Placeholder("Home, End"),
            h.Value((plan.otherKeys ?? []).join(", ")),
            h.OnChange((text) => Message.ChangedOtherKeys({ text }))
          ])
        ]
      ),
      h.table(
        [h.Id("controls")],
        controlRows(plan).map((control) => {
          const setting = plan.controls[control.key] ?? {}
          return h.tr(
            [],
            [
              h.td([], [control.name]),
              h.td(
                [],
                [
                  h.div(
                    [h.Class("fixed")],
                    [
                      setting.other
                        ? `Used by something else${setting.note ? `: ${setting.note}` : ""}.`
                        : control.fixed
                    ]
                  ),
                  ...(control.editable
                    ? [
                        h.label(
                          [h.Class("sub")],
                          [
                            h.input([
                              h.Type("checkbox"),
                              h.Checked(Boolean(setting.other)),
                              h.OnChange(() => Message.ToggledControlOther({ key: control.key, other: !setting.other }))
                            ]),
                            " used by something else"
                          ]
                        ),
                        " ",
                        h.input([
                          h.Type("text"),
                          h.Placeholder("Your note"),
                          h.Value(setting.note ?? ""),
                          h.OnChange((note) => Message.ChangedControlNote({ key: control.key, note }))
                        ])
                      ]
                    : [])
                ]
              )
            ]
          )
        })
      )
    ]
  )

export const Steam = (h: H, plan: Plan): Html =>
  h.div(
    [h.Class("panel notes")],
    [
      h.h2([], ["Steam Input"]),
      h.p(
        [h.Class("sub")],
        [
          "Only needed for back buttons, trackpads or gyro. Set these in Steam's controller settings for WoW, using the controller."
        ]
      ),
      h.ol(
        [h.Id("steam-steps")],
        steamSteps(plan).map((text) => h.li([], [text]))
      )
    ]
  )

const BANDS: ReadonlyArray<readonly [number, number]> = [
  [1, 10],
  [11, 20],
  [21, 30],
  [31, 40],
  [41, 50],
  [51, 60]
]

export const Palette = (h: H, model: Model, plan: Plan): Html => {
  const query = model.search.trim().toLowerCase()
  const counts = usedCounts(plan)
  const data = classCatalog(plan.class)
  const matches = (spell: Spell) => {
    if (!query) return true
    if (spell.name.toLowerCase().includes(query)) return true
    return spell.aliases.some((alias) => alias.toLowerCase().includes(query))
  }
  const spellNode = (spell: Spell): Html => {
    const used = counts.get(spell.name)
    return h.div(
      [
        h.Class(
          ["spell", spell.level > plan.level ? "too-high" : "", model.picked === spell.name ? "picked" : ""]
            .filter((name) => name)
            .join(" ")
        ),
        h.Draggable(true),
        h.DataAttribute("tip-id", `spell:${spell.name}`),
        h.AriaLabel(spell.name),
        h.OnMouseEnter(Message.HoveredTip({ target: `spell:${spell.name}` })),
        h.OnMouseLeave(Message.LeftTip()),
        h.OnDragStart(Message.StartedDragSpell({ spell: spell.name })),
        h.OnDragEnd(Message.EndedDrag()),
        h.OnClick(Message.ClickedSpell({ spell: spell.name }))
      ],
      [
        h.img([h.Src(spell.icon ? `/icons/${spell.icon}.jpg` : ""), h.Alt("")]),
        h.span(
          [h.Class("name")],
          [
            spell.name,
            " ",
            ...(spell.talent ? [h.span([h.Class("tag")], ["talent"])] : []),
            ...(spell.kind === "macro" ? [h.span([h.Class("tag")], ["macro"])] : [])
          ]
        ),
        ...(used ? [h.span([h.Class("used")], [`on ${used}`])] : []),
        h.span([h.Class("meta")], [spell.level > 1 ? String(spell.level) : ""])
      ]
    )
  }
  const section = (title: string, spells: ReadonlyArray<Spell>): ReadonlyArray<Html> => {
    const visible = spells.filter(matches)
    return visible.length ? [h.div([h.Class("group-title")], [title]), ...visible.map(spellNode)] : []
  }
  return h.aside(
    [h.Class("panel")],
    [
      h.h2([], ["Spells"]),
      h.div(
        [h.Class("toolbar")],
        [
          h.input([
            h.Type("text"),
            h.Id("search"),
            h.Placeholder("Search"),
            h.Style({ flex: "1" }),
            h.Value(model.search),
            h.OnInput((search) => Message.ChangedSearch({ search }))
          ])
        ]
      ),
      h.div(
        [h.Class("palette"), h.Id("palette"), h.AllowDrop(), h.OnDrop(Message.DroppedOnPalette())],
        [
          ...BANDS.flatMap(([from, to]) =>
            section(
              `Levels ${from} to ${to}`,
              data.spells.filter((spell) => spell.level >= from && spell.level <= to)
            )
          ),
          ...section("Macros", data.macros),
          ...section("Everyone", catalog.shared)
        ]
      )
    ]
  )
}

export const AccountBar = (h: H, model: Model): Html => {
  const account = model.account
  if (account._tag === "SignedIn") {
    const nickname = account.user.nickname
    return h.span(
      [h.Class("sub account")],
      nickname === null
        ? [
            "Pick a nickname: ",
            h.input([
              h.Type("text"),
              h.Id("nickname"),
              h.Placeholder("2 to 24 characters"),
              h.Value(model.nicknameDraft),
              h.OnInput((value) => Message.ChangedNicknameDraft({ nickname: value }))
            ]),
            " ",
            h.button([h.Id("save-nickname"), h.OnClick(Message.ClickedSaveNickname())], ["Save"])
          ]
        : [
            `Signed in as ${nickname}. Your layouts follow you between machines. `,
            h.form(
              [h.Attribute("method", "post"), h.Attribute("action", "/auth/logout"), h.Style({ display: "inline" })],
              [h.button([h.Type("submit")], ["Sign out"])]
            )
          ]
    )
  }
  if (account._tag === "SignedOut") {
    return h.span(
      [h.Class("sub account")],
      [h.a([h.Href("/auth/login"), h.Id("sign-in")], ["Sign in"]), " to keep your layouts on every machine."]
    )
  }
  return h.span([h.Class("sub account")], [])
}
