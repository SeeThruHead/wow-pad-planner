import { Effect, Option, Schema } from "effect"
import * as Command from "foldkit/command"
import { readCode } from "../../domain/Exports.ts"
import { Nickname } from "../../features/account/Account.ts"
import { SavedCharacter } from "../../features/characters/Saved.ts"
import { ApiClient } from "../api/ApiClient.ts"
import { Message } from "./messages.ts"
import { emptyLibrary, migrateOldLayouts } from "./library.ts"
import { Library, OldLibrary } from "./model.ts"

export const STORAGE_KEY = "wow-pad-planner:v3"
const OLD_STORAGE_KEY = "wow-pad-planner:v2"
const TOAST_MS = 3200

const decodeLibrary = Schema.decodeUnknownOption(Schema.fromJsonString(Library))
const decodeOldLibrary = Schema.decodeUnknownOption(Schema.fromJsonString(OldLibrary))
const encodeLibrary = Schema.encodeSync(Schema.fromJsonString(Library))

const randomDevice = Effect.sync(() =>
  Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) => byte.toString(16).padStart(2, "0")).join("")
)

const fromOld = (device: string) =>
  Option.match(decodeOldLibrary(localStorage.getItem(OLD_STORAGE_KEY) ?? ""), {
    onNone: () => emptyLibrary(device),
    onSome: (old) => ({ ...emptyLibrary(device), characters: migrateOldLayouts(old.layouts, device) })
  })

export const LoadLibrary = Command.define("LoadLibrary", {
  messages: [Message.LoadedLibrary],
  execute: Effect.gen(function* () {
    const device = yield* randomDevice
    const saved = decodeLibrary(localStorage.getItem(STORAGE_KEY) ?? "")
    return Message.LoadedLibrary({ library: Option.getOrElse(saved, () => fromOld(device)) })
  })
})

export const SaveLibrary = Command.define("SaveLibrary", {
  args: { library: Library },
  messages: [Message.SavedLocally],
  execute: ({ library }) =>
    Effect.sync(() => {
      localStorage.setItem(STORAGE_KEY, encodeLibrary(library))
      return Message.SavedLocally()
    })
})

export const LoadAccount = Command.define("LoadAccount", {
  messages: [Message.GotAccount],
  execute: Effect.flatMap(ApiClient, (api) => api.Me({})).pipe(
    Effect.map((user) => Message.GotAccount({ user })),
    Effect.orElseSucceed(() => Message.GotAccount({ user: null }))
  )
})

export const LoadServerCharacters = Command.define("LoadServerCharacters", {
  messages: [Message.GotServerCharacters],
  execute: Effect.flatMap(ApiClient, (api) => api.MyCharacters({})).pipe(
    Effect.map((characters) => Message.GotServerCharacters({ characters })),
    Effect.orElseSucceed(() => Message.GotServerCharacters({ characters: [] }))
  )
})

export const LoadServerLayouts = Command.define("LoadServerLayouts", {
  messages: [Message.GotServerLayouts],
  execute: Effect.flatMap(ApiClient, (api) => api.MyLayouts({})).pipe(
    Effect.map((layouts) => Message.GotServerLayouts({ layouts })),
    Effect.orElseSucceed(() => Message.GotServerLayouts({ layouts: [] }))
  )
})

export const SaveToServer = Command.define("SaveToServer", {
  args: { saved: SavedCharacter },
  messages: [Message.SavedToServer],
  execute: ({ saved }) =>
    Effect.flatMap(ApiClient, (api) => api.SaveCharacter({ saved })).pipe(
      Effect.map((result) => Message.SavedToServer({ saved: result })),
      Effect.orElseSucceed(() => Message.SavedToServer({ saved: null }))
    )
})

export const SaveNickname = Command.define("SaveNickname", {
  args: { nickname: Nickname },
  messages: [Message.SavedNickname],
  execute: ({ nickname }) =>
    Effect.flatMap(ApiClient, (api) => api.SetNickname({ nickname })).pipe(
      Effect.map((user) => Message.SavedNickname({ user })),
      Effect.orElseSucceed(() => Message.SavedNickname({ user: null }))
    )
})

const nextFrame = Effect.callback<void>((resume) => {
  requestAnimationFrame(() => resume(Effect.void))
})

export const MeasureTip = Command.define("MeasureTip", {
  args: { target: Schema.String },
  messages: [Message.PlacedTip],
  execute: Effect.fnUntraced(function* ({ target }: { readonly target: string }) {
    yield* nextFrame
    const node = document.querySelector(`[data-tip-id="${CSS.escape(target)}"]`)
    const tip = document.getElementById("tip")
    if (!node || !tip) return Message.PlacedTip({ tip: null })
    const box = node.getBoundingClientRect()
    const left = Math.max(
      8,
      Math.min(window.innerWidth - tip.offsetWidth - 8, box.left + box.width / 2 - tip.offsetWidth / 2)
    )
    const below = box.bottom + 10 + tip.offsetHeight < window.innerHeight
    const top = (below ? box.bottom + 10 : box.top - tip.offsetHeight - 10) + window.scrollY
    return Message.PlacedTip({ tip: { target, left: left + window.scrollX, top } })
  })
})

export const Download = Command.define("Download", {
  args: { name: Schema.String, text: Schema.String, type: Schema.String },
  messages: [Message.Downloaded],
  execute: Effect.fnUntraced(function* ({
    name,
    text,
    type
  }: {
    readonly name: string
    readonly text: string
    readonly type: string
  }) {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", name)
    link.click()
    yield* Effect.sleep("1 second")
    URL.revokeObjectURL(url)
    return Message.Downloaded()
  })
})

export const CopyText = Command.define("CopyText", {
  args: { text: Schema.String },
  messages: [Message.CopiedCode],
  execute: ({ text }) =>
    Effect.tryPromise({ try: () => navigator.clipboard.writeText(text), catch: () => "clipboard refused" }).pipe(
      Effect.as(Message.CopiedCode({ copied: true })),
      Effect.orElseSucceed(() => Message.CopiedCode({ copied: false }))
    )
})

export const ReadImport = Command.define("ReadImport", {
  args: { text: Schema.String },
  messages: [Message.ReadImport],
  execute: ({ text }) =>
    readCode(text).pipe(
      Effect.map((plan) => Message.ReadImport({ plan })),
      Effect.orElseSucceed(() => Message.ReadImport({ plan: null }))
    )
})

export const ReadFile = Command.define("ReadFile", {
  args: { file: Schema.instanceOf(File) },
  messages: [Message.ChoseImportFile],
  execute: ({ file }) =>
    Effect.tryPromise({ try: () => file.text(), catch: () => "file unreadable" }).pipe(
      Effect.map((text) => Message.ChoseImportFile({ text })),
      Effect.orElseSucceed(() => Message.ChoseImportFile({ text: "" }))
    )
})

export const HideToastLater = Command.define("HideToastLater", {
  args: { text: Schema.String },
  messages: [Message.HidToast],
  execute: ({ text }) => Effect.sleep(TOAST_MS).pipe(Effect.as(Message.HidToast({ text })))
})
