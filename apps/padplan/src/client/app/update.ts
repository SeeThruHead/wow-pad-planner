import { Option, Schema } from "effect"
import type { Update } from "foldkit"
import { cleanName } from "../../domain/Character.ts"
import type { Character, NamedLayout } from "../../domain/Character.ts"
import { classCatalog } from "../../domain/Catalog.ts"
import { addonCode, toLuaFile } from "../../domain/Exports.ts"
import { fixKeys, mirrorDpad, usesBack, withController } from "../../domain/Layout.ts"
import { CONTROLLERS } from "../../domain/Controllers.ts"
import { foldBackIntoSlots, hasBackSpells, optimizeForBack } from "../../domain/Optimize.ts"
import type { Rearranged as RearrangedPlan } from "../../domain/Optimize.ts"
import { ClassId, entryAt, isPlan, sameLocation, swap, withEntry } from "../../domain/Plan.ts"
import type { Entry, Plan, SlotLocation } from "../../domain/Plan.ts"
import { Nickname } from "../../features/account/Account.ts"
import type { SavedCharacter } from "../../features/characters/Saved.ts"
import type { Saved } from "../../features/layouts/Saved.ts"
import type { ApiClient } from "../api/ApiClient.ts"
import * as Commands from "./commands.ts"
import {
  currentCharacter,
  currentLayout,
  currentPlan,
  migrateOldLayouts,
  nextCharacterId,
  nextLayoutId,
  startPlan,
  startersFor,
  tick,
  withCharacter
} from "./library.ts"
import { Message } from "./messages.ts"
import type { Dialog, Library, Model } from "./model.ts"

export type Return = Update.Return<Model, Message, ApiClient>

type DialogField = "name" | "className" | "level" | "realm" | "start"

const LEVEL_MIN = 1
const LEVEL_MAX = 60

const clampLevel = (text: string, fallback: number): number =>
  Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, Number(text) || fallback))

const signedIn = (model: Model): boolean => model.account._tag === "SignedIn"

const sync = (model: Model, characters: ReadonlyArray<Character>, deleted: boolean) =>
  signedIn(model) ? characters.map((character) => Commands.SaveToServer({ saved: { character, deleted } })) : []

const store = (model: Model, library: Library, changed: ReadonlyArray<Character> = [], deleted = false): Return => ({
  model: { ...model, library },
  commands: [Commands.SaveLibrary({ library }), ...sync(model, changed, deleted)]
})

const toast = (model: Model, text: string): Return => ({
  model: { ...model, toast: text },
  commands: [Commands.HideToastLater({ text })]
})

const withToast = (result: Return, text: string): Return => {
  const shown = toast(result.model, text)
  return { model: shown.model, commands: [...(result.commands ?? []), ...(shown.commands ?? [])] }
}

const saveCharacter = (model: Model, character: Character, extra: Partial<Library> = {}): Return => {
  const stamped = { ...character, updatedAt: tick(model) }
  return store(model, { ...withCharacter(model.library, stamped), ...extra }, [stamped])
}

const editCharacter = (model: Model, change: (character: Character) => Character): Return => {
  const character = currentCharacter(model)
  return character ? saveCharacter(model, change(character)) : { model }
}

const edit = (model: Model, change: (plan: Plan) => Plan): Return => {
  const layout = currentLayout(model)
  if (!layout) return { model }
  const plan = change(currentPlan(model))
  return editCharacter(model, (character) => ({
    ...character,
    layouts: character.layouts.map((item) => (item.id === layout.id ? { ...item, plan } : item))
  }))
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

const newCharacter = (model: Model, dialog: Dialog): Return => {
  const layoutId = nextLayoutId(model.library)
  const starter = startersFor(dialog.className)[0]
  const character: Character = {
    id: nextCharacterId(model.library),
    name: dialog.name.trim() || `My ${classCatalog(dialog.className).name}`,
    className: dialog.className,
    level: clampLevel(dialog.level, LEVEL_MIN),
    realm: dialog.realm.trim(),
    layouts: [{ id: layoutId, name: "Leveling", plan: startPlan(dialog.className, starter?.id ?? "") }],
    activeLayoutId: layoutId,
    updatedAt: 0,
    autoload: "ask"
  }
  return saveCharacter({ ...model, dialog: null }, character, {
    currentCharacterId: character.id,
    currentLayoutId: layoutId
  })
}

const addLayout = (model: Model, layout: NamedLayout): Return => {
  const character = currentCharacter(model)
  if (!character) return { model }
  return saveCharacter(
    { ...model, dialog: null, selected: null },
    { ...character, layouts: [...character.layouts, layout] },
    { currentLayoutId: layout.id }
  )
}

const newLayout = (model: Model, dialog: Dialog): Return => {
  const character = currentCharacter(model)
  if (!character) return { model }
  const plan = startPlan(character.className, dialog.start)
  return addLayout(model, { id: nextLayoutId(model.library), name: dialog.name.trim() || "New layout", plan })
}

const editCharacterDetails = (model: Model, dialog: Dialog): Return => {
  const character = model.library.characters.find((item) => item.id === dialog.start)
  if (!character) return { model: { ...model, dialog: null } }
  return saveCharacter(
    { ...model, dialog: null },
    {
      ...character,
      name: dialog.name.trim() || character.name,
      realm: dialog.realm.trim(),
      level: clampLevel(dialog.level, character.level)
    }
  )
}

const confirmDialog = (model: Model): Return => {
  const dialog = model.dialog
  if (dialog === null) return { model }
  if (dialog.kind === "newCharacter") return newCharacter(model, dialog)
  if (dialog.kind === "renameCharacter") return editCharacterDetails(model, dialog)
  return newLayout(model, dialog)
}

const isClassId = Schema.is(ClassId)

const changedDialog = (model: Model, field: DialogField, value: string): Return => {
  const dialog = model.dialog
  if (dialog === null) return { model }
  if (field !== "className") return { model: { ...model, dialog: { ...dialog, [field]: value } } }
  if (!isClassId(value)) return { model }
  return { model: { ...model, dialog: { ...dialog, className: value, start: startersFor(value)[0]?.id ?? "" } } }
}

const blankDialog = (model: Model, kind: Dialog["kind"]): Dialog => {
  const character = currentCharacter(model)
  const className = character?.className ?? "WARLOCK"
  return {
    kind,
    name: "",
    className,
    level: String(character?.level ?? LEVEL_MIN),
    realm: character?.realm ?? "",
    start: startersFor(className)[0]?.id ?? ""
  }
}

const characterDialog = (character: Character): Dialog => ({
  kind: "renameCharacter",
  name: character.name,
  className: character.className,
  level: String(character.level),
  realm: character.realm,
  start: character.id
})

const deleteCharacter = (model: Model, id: string): Return => {
  const character = model.library.characters.find((item) => item.id === id)
  if (!character) return { model }
  const library = {
    ...model.library,
    characters: model.library.characters.filter((item) => item.id !== id),
    currentCharacterId: model.library.currentCharacterId === id ? "" : model.library.currentCharacterId
  }
  return store(model, library, [{ ...character, updatedAt: tick(model) }], true)
}

const deleteLayout = (model: Model): Return => {
  const character = currentCharacter(model)
  const layout = currentLayout(model)
  if (!character || !layout || character.layouts.length < 2)
    return toast(model, "A character keeps at least one layout.")
  const layouts = character.layouts.filter((item) => item.id !== layout.id)
  const activeLayoutId = character.activeLayoutId === layout.id ? (layouts[0]?.id ?? "") : character.activeLayoutId
  return saveCharacter(
    { ...model, selected: null },
    { ...character, layouts, activeLayoutId },
    { currentLayoutId: activeLayoutId }
  )
}

const characterForClass = (model: Model, plan: Plan): Character | undefined => {
  const current = currentCharacter(model)
  if (current?.className === plan.class) return current
  return model.library.characters.find((character) => character.className === plan.class)
}

const newCharacterFor = (model: Model, layout: NamedLayout, plan: Plan): Character => ({
  id: nextCharacterId(model.library),
  name: `My ${classCatalog(plan.class).name}`,
  className: plan.class,
  level: plan.level,
  realm: "",
  layouts: [layout],
  activeLayoutId: layout.id,
  updatedAt: 0,
  autoload: "ask"
})

const imported = (model: Model, plan: Plan | null): Return => {
  if (plan === null || !isPlan(plan)) return toast(model, "That isn't a layout from this planner.")
  const closed = { ...model, importOpen: false, importText: "" }
  const layout = { id: nextLayoutId(model.library), name: cleanName(plan.name), plan: { ...plan, activeSet: 0 } }
  const existing = characterForClass(closed, plan)
  const target = existing
    ? { ...existing, layouts: [...existing.layouts, layout] }
    : newCharacterFor(model, layout, plan)
  const result = saveCharacter(closed, target, { currentCharacterId: target.id, currentLayoutId: layout.id })
  return withToast(result, `Imported "${layout.name}" into ${target.name}.`)
}

const activePlan = (model: Model): Plan => {
  const character = currentCharacter(model)
  const active = character?.layouts.find((layout) => layout.id === character.activeLayoutId)
  if (!character || !active) return currentPlan(model)
  return { ...active.plan, name: active.name, class: character.className, level: character.level }
}

const fileName = (plan: Plan): string => `${plan.name.replace(/[^\w-]+/g, "-")}.json`

const mergeServer = (model: Model, saved: ReadonlyArray<SavedCharacter>): Return => {
  const local = new Map<string, Character>(model.library.characters.map((character) => [character.id, character]))
  const newer = saved.filter((item) => item.character.updatedAt > (local.get(item.character.id)?.updatedAt ?? -1))
  const incoming = new Map<string, SavedCharacter>(newer.map((item) => [item.character.id, item]))
  const kept = model.library.characters.flatMap((character) => {
    const item = incoming.get(character.id)
    if (!item) return [character]
    return item.deleted ? [] : [item.character]
  })
  const added = newer.filter((item) => !item.deleted && !local.has(item.character.id)).map((item) => item.character)
  const library = { ...model.library, characters: [...kept, ...added] }
  const remote = new Map<string, number>(saved.map((item) => [item.character.id, item.character.updatedAt]))
  const unsent = library.characters.filter((character) => character.updatedAt > (remote.get(character.id) ?? -1))
  const clock = Math.max(model.clock, ...saved.map((item) => item.character.updatedAt))
  return {
    model: { ...model, library, clock },
    commands: [
      Commands.SaveLibrary({ library }),
      ...unsent.map((character) => Commands.SaveToServer({ saved: { character, deleted: false } })),
      ...(saved.length === 0 ? [Commands.LoadServerLayouts()] : [])
    ]
  }
}

const adoptOldServerLayouts = (model: Model, layouts: ReadonlyArray<Saved>): Return => {
  const live = layouts.filter((layout) => !layout.deleted)
  if (live.length === 0) return { model }
  const characters = migrateOldLayouts(live, `${model.library.device}s`)
  return store(model, characters.reduce(withCharacter, model.library), characters)
}

const decodeNickname = Schema.decodeUnknownOption(Nickname)

const saveNickname = (model: Model): Return => {
  const nickname = decodeNickname(model.nicknameDraft)
  if (Option.isNone(nickname)) return toast(model, "Pick a nickname of 2 to 24 characters.")
  return { model, commands: [Commands.SaveNickname({ nickname: nickname.value })] }
}

const backPatch = (
  model: Model,
  id: string,
  patch: Partial<{ use: "slot" | "other"; key: string; note: string }>
): Return =>
  edit(model, (plan) => ({
    ...plan,
    back: { ...plan.back, [id]: { ...(plan.back[id] ?? { use: "slot", key: "F9", note: "" }), ...patch } }
  }))

const offerOf = (kind: "optimize" | "fold", result: RearrangedPlan) =>
  result.moves.length > 0 ? { kind, plan: result.plan, moves: result.moves } : null

const switchController = (model: Model, controller: Plan["controller"]): Return => {
  const before = currentPlan(model)
  const after = withController(before, controller)
  const result = edit({ ...model, offer: null }, () => after)
  if (!usesBack(before) && usesBack(after))
    return { ...result, model: { ...result.model, offer: offerOf("optimize", optimizeForBack(after)) } }
  if (usesBack(before) && CONTROLLERS[controller].back.length === 0 && hasBackSpells(before)) {
    return { ...result, model: { ...result.model, offer: offerOf("fold", foldBackIntoSlots(after)) } }
  }
  return result
}

const toggleBack = (model: Model, on: boolean): Return => {
  const after = { ...currentPlan(model), useBackButtons: on }
  const result = edit({ ...model, offer: null }, () => after)
  return on && usesBack(after)
    ? { ...result, model: { ...result.model, offer: offerOf("optimize", optimizeForBack(after)) } }
    : result
}

const acceptOffer = (model: Model): Return => {
  const offer = model.offer
  const character = currentCharacter(model)
  const layout = currentLayout(model)
  if (offer === null || !character || !layout) return { model: { ...model, offer: null } }
  const id = nextLayoutId(model.library)
  const name = `${layout.name} (${offer.kind === "optimize" ? "back buttons" : "no back buttons"})`
  const added = addLayout({ ...model, offer: null }, { id, name, plan: offer.plan })
  const rearranged = { characterId: character.id, layoutId: id, originalId: layout.id }
  return withToast(
    { ...added, model: { ...added.model, rearranged } },
    `Made the new tab "${name}". The original is unchanged.`
  )
}

const undoRearrange = (model: Model): Return => {
  const rearranged = model.rearranged
  const character = model.library.characters.find((item) => item.id === rearranged?.characterId)
  if (!rearranged || !character) return { model: { ...model, rearranged: null } }
  const layouts = character.layouts.filter((layout) => layout.id !== rearranged.layoutId)
  const activeLayoutId =
    character.activeLayoutId === rearranged.layoutId ? rearranged.originalId : character.activeLayoutId
  return saveCharacter(
    { ...model, rearranged: null },
    { ...character, layouts, activeLayoutId },
    { currentLayoutId: rearranged.originalId }
  )
}

const openCharacter = (model: Model, id: string): Return => {
  const character = model.library.characters.find((item) => item.id === id)
  return store(
    { ...model, selected: null },
    { ...model.library, currentCharacterId: id, currentLayoutId: character?.activeLayoutId ?? "" }
  )
}

const renameLayout = (model: Model, name: string): Return => {
  const layout = currentLayout(model)
  if (!layout || !name.trim()) return { model }
  return editCharacter(model, (character) => ({
    ...character,
    layouts: character.layouts.map((item) => (item.id === layout.id ? { ...item, name: name.trim() } : item))
  }))
}

export const update = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    LoadedLibrary: ({ library }) => ({
      model: { ...model, library },
      commands: [Commands.SaveLibrary({ library }), Commands.LoadAccount()]
    }),
    OpenedCharacter: ({ id }) => openCharacter(model, id),
    ClickedCharacters: () => store({ ...model, selected: null }, { ...model.library, currentCharacterId: "" }),
    ClickedNewCharacter: () => ({
      model: { ...model, dialog: { ...blankDialog(model, "newCharacter"), level: "1", realm: "" } }
    }),
    ClickedRenameCharacter: ({ id }) => {
      const character = model.library.characters.find((item) => item.id === id)
      return character ? { model: { ...model, dialog: characterDialog(character) } } : { model }
    },
    ClickedDeleteCharacter: ({ id }) => deleteCharacter(model, id),
    ChangedDialog: ({ field, value }) => changedDialog(model, field, value),
    ClickedConfirmDialog: () => confirmDialog(model),
    ClickedCancelDialog: () => ({ model: { ...model, dialog: null } }),
    ChangedCharacterLevel: ({ level }) =>
      editCharacter(model, (character) => ({ ...character, level: clampLevel(level, character.level) })),
    ChangedAutoload: ({ autoload }) => editCharacter(model, (character) => ({ ...character, autoload })),
    PickedTab: ({ id }) => store({ ...model, selected: null }, { ...model.library, currentLayoutId: id }),
    ClickedNewLayout: () => ({ model: { ...model, dialog: blankDialog(model, "newLayout") } }),
    RenamedLayout: ({ name }) => renameLayout(model, name),
    ClickedDuplicateLayout: () => {
      const layout = currentLayout(model)
      return layout
        ? addLayout(model, { ...layout, id: nextLayoutId(model.library), name: `${layout.name} 2` })
        : { model }
    },
    ClickedDeleteLayout: () => deleteLayout(model),
    ClickedMakeActive: () =>
      editCharacter(model, (character) => ({
        ...character,
        activeLayoutId: currentLayout(model)?.id ?? character.activeLayoutId
      })),
    PickedController: ({ controller }) => switchController(model, controller),
    PickedSet: ({ index }) => edit({ ...model, selected: null }, (plan) => ({ ...plan, activeSet: index })),
    RenamedSet: ({ name }) =>
      edit(model, (plan) => {
        const sets = plan.sets.map((set, index) =>
          index === plan.activeSet ? { ...set, name: name.trim() || `Set ${index + 1}` } : set
        )
        return { ...plan, sets: [sets[0] ?? plan.sets[0], sets[1] ?? plan.sets[1], sets[2] ?? plan.sets[2]] }
      }),
    ToggledBackButtons: ({ on }) => toggleBack(model, on),
    AcceptedOffer: () => acceptOffer(model),
    DismissedOffer: () => ({ model: { ...model, offer: null } }),
    UndidRearrange: () => undoRearrange(model),
    ChangedBackUse: ({ id, use }) => backPatch(model, id, { use }),
    ChangedBackKey: ({ id, key }) => backPatch(model, id, { key }),
    ChangedBackNote: ({ id, note }) => backPatch(model, id, { note }),
    ClickedMirror: () => edit(model, mirrorDpad),
    ClickedFixKeys: () => edit(model, fixKeys),
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
      withToast(
        {
          model,
          commands: [
            Commands.Download({
              name: "PadPlanData.lua",
              text: toLuaFile(model.library.characters),
              type: "text/plain"
            })
          ]
        },
        "Saved PadPlanData.lua with every character's active layout: put it in Interface/AddOns/PadPlan."
      ),
    ClickedCopyCode: () => {
      const code = addonCode(activePlan(model))
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
    HidToast: ({ text }) => ({ model: model.toast === text ? { ...model, toast: null } : model }),
    Downloaded: () => ({ model }),
    SavedLocally: () => ({ model }),
    GotAccount: ({ user }) =>
      user === null
        ? { model: { ...model, account: { _tag: "SignedOut" } } }
        : { model: { ...model, account: { _tag: "SignedIn", user } }, commands: [Commands.LoadServerCharacters()] },
    GotServerCharacters: ({ characters }) => mergeServer(model, characters),
    GotServerLayouts: ({ layouts }) => adoptOldServerLayouts(model, layouts),
    SavedToServer: () => ({ model }),
    ChangedNicknameDraft: ({ nickname }) => ({ model: { ...model, nicknameDraft: nickname } }),
    ClickedSaveNickname: () => saveNickname(model),
    SavedNickname: ({ user }) =>
      user === null
        ? toast(model, "That nickname couldn't be saved.")
        : { model: { ...model, account: { _tag: "SignedIn", user }, nicknameDraft: "" } }
  })
