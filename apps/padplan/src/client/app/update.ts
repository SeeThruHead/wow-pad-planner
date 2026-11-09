import { Option, Schema } from "effect"
import type { Update } from "foldkit"
import { addonCode, toLua } from "../../domain/Exports.ts"
import { emptyPlan, fixKeys, mirrorDpad, withController } from "../../domain/Layout.ts"
import { entryAt, isPlan, sameLocation, swap, withEntry } from "../../domain/Plan.ts"
import type { Entry, Plan, SlotLocation } from "../../domain/Plan.ts"
import { Nickname } from "../../features/account/Account.ts"
import type { Saved } from "../../features/layouts/Saved.ts"
import { LayoutId } from "../../features/layouts/Saved.ts"
import type { ApiClient } from "../api/ApiClient.ts"
import * as Commands from "./commands.ts"
import { currentPlan, emptyLibrary, firstStarter, isBuiltin, nextId, withLayout } from "./library.ts"
import { Message } from "./messages.ts"
import type { Library, Model, StoredLayout } from "./model.ts"

export type Return = Update.Return<Model, Message, ApiClient>

const signedIn = (model: Model): boolean => model.account._tag === "SignedIn"

const savedOf = (layout: StoredLayout, deleted: boolean): Saved => ({
  id: LayoutId.make(layout.id),
  plan: layout.plan,
  updatedAt: layout.updatedAt ?? 0,
  deleted
})

const store = (model: Model, library: Library, changed: ReadonlyArray<StoredLayout>, deleted = false): Return => ({
  model: { ...model, library },
  commands: [
    Commands.SaveLibrary({ library }),
    ...(signedIn(model) ? changed.map((layout) => Commands.SaveToServer({ layout: savedOf(layout, deleted) })) : [])
  ]
})

const toast = (model: Model, text: string): Return => ({
  model: { ...model, toast: text },
  commands: [Commands.HideToastLater({ text })]
})

const merge = (result: Return, extra: Return): Return => ({
  model: extra.model,
  commands: [...(result.commands ?? []), ...(extra.commands ?? [])]
})

const addLayout = (model: Model, plan: Plan): Return => {
  const layout = { id: nextId(model.library), plan, updatedAt: tick(model) }
  const library = { ...withLayout(model.library, layout), currentId: layout.id }
  return store({ ...model, selected: null }, library, [layout])
}

const tick = (model: Model): number =>
  Math.max(
    model.clock,
    model.library.layouts.reduce((max, layout) => Math.max(max, layout.updatedAt ?? 0), 0)
  ) + 1

const edit = (model: Model, change: (plan: Plan) => Plan): Return => {
  const plan = currentPlan(model)
  const id = model.library.currentId
  if (isBuiltin(id) || id === "") {
    const copied = addLayout(model, change({ ...plan, name: `${plan.name} (my copy)` }))
    return merge(copied, toast(copied.model, "Built-in layouts are read-only, so this is now your own copy."))
  }
  const layout = { id, plan: change(plan), updatedAt: tick(model) }
  return store(model, withLayout(model.library, layout), [layout])
}

const view = (model: Model, patch: Partial<Plan>): Return => {
  const id = model.library.currentId
  if (isBuiltin(id)) return { model: { ...model, builtinSets: { ...model.builtinSets, [id]: patch.activeSet ?? 0 } } }
  return edit(model, (plan) => ({ ...plan, ...patch }))
}

const place = (model: Model, location: SlotLocation, entry: Entry | undefined): Return =>
  edit({ ...model, dragging: null }, (plan) => withEntry(plan, location, entry))

const dropOnSlot = (model: Model, location: SlotLocation): Return => {
  const dragging = model.dragging
  if (dragging === null) return { model }
  if ("spell" in dragging) return place(model, location, { ref: dragging.spell })
  return edit({ ...model, dragging: null }, (plan) => swap(plan, dragging, location))
}

const clickSlot = (model: Model, location: SlotLocation): Return => {
  if (model.picked !== null)
    return place({ ...model, picked: null, selected: location }, location, { ref: model.picked })
  return { model: { ...model, selected: sameLocation(model.selected, location) ? null : location } }
}

const customEntry = (model: Model, patch: { readonly label?: string; readonly body?: string }): Return => {
  const location = model.selected
  if (location === null) return { model }
  const current = entryAt(currentPlan(model), location)
  const custom = current && "custom" in current ? current.custom : { label: "Custom", body: "" }
  return place(model, location, { custom: { ...custom, ...patch } })
}

const imported = (model: Model, plan: Plan | null): Return => {
  if (plan === null || !isPlan(plan)) return toast(model, "That isn't a layout from this planner.")
  const added = addLayout({ ...model, importOpen: false, importText: "" }, { ...plan, activeSet: 0 })
  return merge(added, toast(added.model, `Imported "${plan.name}".`))
}

const fileName = (plan: Plan): string => `${plan.name.replace(/[^\w-]+/g, "-")}.json`

const mergeServer = (model: Model, layouts: ReadonlyArray<Saved>): Return => {
  const local = new Map<string, StoredLayout>(model.library.layouts.map((layout) => [layout.id, layout]))
  const newer = layouts.filter((saved) => saved.updatedAt > (local.get(saved.id)?.updatedAt ?? -1))
  const incoming = new Map<string, Saved>(newer.map((saved) => [saved.id, saved]))
  const kept = model.library.layouts.flatMap((layout) => {
    const saved = incoming.get(layout.id)
    if (!saved) return [layout]
    return saved.deleted ? [] : [{ id: layout.id, plan: saved.plan, updatedAt: saved.updatedAt }]
  })
  const added = newer
    .filter((saved) => !saved.deleted && !local.has(saved.id))
    .map((saved) => ({ id: saved.id, plan: saved.plan, updatedAt: saved.updatedAt }))
  const library = { ...model.library, layouts: [...kept, ...added] }
  const remote = new Map<string, number>(layouts.map((saved) => [saved.id, saved.updatedAt]))
  const unsent = library.layouts.filter((layout) => (layout.updatedAt ?? 0) > (remote.get(layout.id) ?? -1))
  const clock = Math.max(model.clock, ...layouts.map((saved) => saved.updatedAt))
  return {
    model: { ...model, library, clock },
    commands: [
      Commands.SaveLibrary({ library }),
      ...unsent.map((layout) => Commands.SaveToServer({ layout: savedOf(layout, false) }))
    ]
  }
}

const decodeNickname = Schema.decodeUnknownOption(Nickname)

const saveNickname = (model: Model): Return => {
  const nickname = decodeNickname(model.nicknameDraft)
  if (Option.isNone(nickname)) return toast(model, "Pick a nickname of 2 to 24 characters.")
  return { model, commands: [Commands.SaveNickname({ nickname: nickname.value })] }
}

const deleteCurrent = (model: Model): Return => {
  const id = model.library.currentId
  const layout = model.library.layouts.find((item) => item.id === id)
  if (isBuiltin(id) || !layout) return { model }
  const library = {
    ...model.library,
    layouts: model.library.layouts.filter((item) => item.id !== id),
    currentId: firstStarter
  }
  return store({ ...model, selected: null }, library, [{ ...layout, updatedAt: tick(model) }], true)
}

export const update = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    LoadedLibrary: ({ library }) => {
      const loaded = library ?? emptyLibrary("local")
      return {
        model: { ...model, library: { ...loaded, currentId: loaded.currentId || firstStarter } },
        commands: [Commands.LoadAccount()]
      }
    },
    PickedLayout: ({ id }) => store({ ...model, selected: null }, { ...model.library, currentId: id }, []),
    RenamedLayout: ({ name }) => edit(model, (plan) => ({ ...plan, name: name.trim() || plan.name })),
    ClickedNew: () => addLayout(model, emptyPlan(currentPlan(model).class, currentPlan(model).controller)),
    ClickedDuplicate: () => addLayout(model, { ...currentPlan(model), name: `${currentPlan(model).name} (copy)` }),
    ClickedDelete: () => deleteCurrent(model),
    CreatedLayout: ({ plan }) => addLayout(model, plan),
    PickedClass: ({ className }) => addLayout(model, emptyPlan(className, currentPlan(model).controller)),
    PickedController: ({ controller }) => edit(model, (plan) => withController(plan, controller)),
    ChangedLevel: ({ level }) => view(model, { level: Math.max(1, Math.min(60, Number(level) || 60)) }),
    PickedSet: ({ index }) => view({ ...model, selected: null }, { activeSet: index }),
    RenamedSet: ({ name }) =>
      edit(model, (plan) => {
        const sets = plan.sets.map((set, index) =>
          index === plan.activeSet ? { ...set, name: name.trim() || `Set ${index + 1}` } : set
        )
        return { ...plan, sets: [sets[0] ?? plan.sets[0], sets[1] ?? plan.sets[1], sets[2] ?? plan.sets[2]] }
      }),
    ToggledBackButtons: ({ on }) => edit(model, (plan) => ({ ...plan, useBackButtons: on })),
    ChangedBackUse: ({ id, use }) =>
      edit(model, (plan) => ({
        ...plan,
        back: { ...plan.back, [id]: { ...(plan.back[id] ?? { key: "F9", note: "" }), use } }
      })),
    ChangedBackKey: ({ id, key }) =>
      edit(model, (plan) => ({
        ...plan,
        back: { ...plan.back, [id]: { ...(plan.back[id] ?? { use: "slot", note: "" }), key } }
      })),
    ChangedBackNote: ({ id, note }) =>
      edit(model, (plan) => ({
        ...plan,
        back: { ...plan.back, [id]: { ...(plan.back[id] ?? { use: "other", key: "" }), note } }
      })),
    ClickedMirror: () => edit(model, mirrorDpad),
    ClickedFixKeys: () => edit(model, fixKeys),
    ClickedOpenSource: ({ id }) => store({ ...model, selected: null }, { ...model.library, currentId: id }, []),
    ClickedSlot: ({ location }) => clickSlot(model, location),
    RightClickedSlot: ({ location }) => place(model, location, undefined),
    StartedDragSlot: ({ location }) => ({ model: { ...model, dragging: location, tip: null, hovered: null } }),
    StartedDragSpell: ({ spell }) => ({ model: { ...model, dragging: { spell }, tip: null, hovered: null } }),
    DroppedOnSlot: ({ location }) => dropOnSlot(model, location),
    DroppedOnPalette: () => {
      const dragging = model.dragging
      if (dragging === null || "spell" in dragging) return { model: { ...model, dragging: null } }
      return place(model, dragging, undefined)
    },
    EndedDrag: () => ({ model: { ...model, dragging: null } }),
    ClickedSpell: ({ spell }) => ({
      model: { ...model, picked: model.picked === spell ? null : spell, selected: null }
    }),
    ClearedSelectedSlot: () => {
      const location = model.selected
      if (location === null) return { model }
      return place({ ...model, selected: null }, location, undefined)
    },
    MadeSelectedCustom: () => customEntry(model, {}),
    ChangedCustomLabel: ({ label }) => customEntry(model, { label }),
    ChangedCustomBody: ({ body }) => customEntry(model, { body }),
    ChangedSearch: ({ search }) => ({ model: { ...model, search } }),
    ChangedWhy: ({ why }) => edit(model, (plan) => ({ ...plan, why })),
    ChangedOtherKeys: ({ text }) =>
      edit(model, (plan) => ({
        ...plan,
        otherKeys: text
          .split(",")
          .map((key) => key.trim())
          .filter((key) => key.length > 0)
      })),
    ToggledControlOther: ({ key, other }) =>
      edit(model, (plan) => ({ ...plan, controls: { ...plan.controls, [key]: { ...plan.controls[key], other } } })),
    ChangedControlNote: ({ key, note }) =>
      edit(model, (plan) => ({ ...plan, controls: { ...plan.controls, [key]: { ...plan.controls[key], note } } })),
    HoveredTip: ({ target }) =>
      model.dragging === null
        ? { model: { ...model, hovered: target, tip: null }, commands: [Commands.MeasureTip({ target })] }
        : { model },
    PlacedTip: ({ tip }) => ({ model: tip !== null && tip.target === model.hovered ? { ...model, tip } : model }),
    LeftTip: () => ({ model: { ...model, hovered: null, tip: null } }),
    ClickedDownloadLua: () =>
      merge(
        {
          model,
          commands: [
            Commands.Download({ name: "PadPlanData.lua", text: toLua(currentPlan(model)), type: "text/plain" })
          ]
        },
        toast(model, "Saved PadPlanData.lua: put it in Interface/AddOns/PadPlan.")
      ),
    ClickedCopyCode: () => {
      const code = addonCode(currentPlan(model))
      return { model: { ...model, codeText: code }, commands: [Commands.CopyText({ text: code })] }
    },
    CopiedCode: ({ copied }) =>
      toast(
        model,
        copied
          ? "Layout code copied. Paste it in game with /padplan import, or in a planner with Import."
          : "Copy the code from the box."
      ),
    ClickedImport: () => ({ model: { ...model, importOpen: true, importText: "" } }),
    ChangedImportText: ({ text }) => ({ model: { ...model, importText: text } }),
    ClickedImportCode: () => ({ model, commands: [Commands.ReadImport({ text: model.importText })] }),
    PickedImportFile: ({ file }) => ({ model, commands: [Commands.ReadFile({ file })] }),
    ChoseImportFile: ({ text }) => ({ model, commands: [Commands.ReadImport({ text })] }),
    ReadImport: ({ plan }) => imported(model, plan),
    ClickedExport: () => ({
      model,
      commands: [
        Commands.Download({
          name: fileName(currentPlan(model)),
          text: JSON.stringify(currentPlan(model), null, 2),
          type: "application/json"
        })
      ]
    }),
    ShowedToast: ({ text }) => toast(model, text),
    HidToast: ({ text }) => ({ model: model.toast === text ? { ...model, toast: null } : model }),
    Downloaded: () => ({ model }),
    SavedLocally: () => ({ model }),
    GotAccount: ({ user }) =>
      user === null
        ? { model: { ...model, account: { _tag: "SignedOut" } } }
        : { model: { ...model, account: { _tag: "SignedIn", user } }, commands: [Commands.LoadServerLayouts()] },
    GotServerLayouts: ({ layouts }) => mergeServer(model, layouts),
    SavedToServer: () => ({ model }),
    ChangedNicknameDraft: ({ nickname }) => ({ model: { ...model, nicknameDraft: nickname } }),
    ClickedSaveNickname: () => saveNickname(model),
    SavedNickname: ({ user }) =>
      user === null
        ? toast(model, "That nickname couldn't be saved.")
        : { model: { ...model, account: { _tag: "SignedIn", user }, nicknameDraft: "" } }
  })
