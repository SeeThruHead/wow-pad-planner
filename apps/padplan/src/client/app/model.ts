import { Schema } from "effect"
import { Character } from "../../domain/Character.ts"
import { ClassId, Plan, SlotLocation } from "../../domain/Plan.ts"
import { User } from "../../features/account/Account.ts"

export const OldLayout = Schema.Struct({ id: Schema.String, plan: Plan, updatedAt: Schema.optionalKey(Schema.Int) })
export type OldLayout = typeof OldLayout.Type

export const OldLibrary = Schema.Struct({
  layouts: Schema.Array(OldLayout),
  currentId: Schema.String,
  device: Schema.optionalKey(Schema.String)
})
export type OldLibrary = typeof OldLibrary.Type

export const Library = Schema.Struct({
  characters: Schema.Array(Character),
  currentCharacterId: Schema.String,
  currentLayoutId: Schema.String,
  device: Schema.String
})
export type Library = typeof Library.Type

export const Account = Schema.Union([
  Schema.TaggedStruct("Unknown", {}),
  Schema.TaggedStruct("SignedOut", {}),
  Schema.TaggedStruct("SignedIn", { user: User })
])
export type Account = typeof Account.Type

export const Tip = Schema.Struct({ target: Schema.String, left: Schema.Finite, top: Schema.Finite })
export type Tip = typeof Tip.Type

export const Dialog = Schema.Struct({
  kind: Schema.Literals(["newCharacter", "newLayout", "renameCharacter"]),
  name: Schema.String,
  className: ClassId,
  level: Schema.String,
  realm: Schema.String,
  start: Schema.String
})
export type Dialog = typeof Dialog.Type

export const Move = Schema.Struct({ name: Schema.String, from: Schema.String, to: Schema.String })

export const Offer = Schema.Struct({
  kind: Schema.Literals(["optimize", "fold"]),
  plan: Plan,
  moves: Schema.Array(Move)
})
export type Offer = typeof Offer.Type

export const Rearranged = Schema.Struct({
  characterId: Schema.String,
  layoutId: Schema.String,
  originalId: Schema.String
})

export const Model = Schema.Struct({
  library: Library,
  selected: Schema.NullOr(SlotLocation),
  picked: Schema.NullOr(Schema.String),
  dragging: Schema.NullOr(Schema.Union([SlotLocation, Schema.Struct({ spell: Schema.String })])),
  search: Schema.String,
  hovered: Schema.NullOr(Schema.String),
  tip: Schema.NullOr(Tip),
  toast: Schema.NullOr(Schema.String),
  codeText: Schema.NullOr(Schema.String),
  importOpen: Schema.Boolean,
  importText: Schema.String,
  account: Account,
  clock: Schema.Int,
  nicknameDraft: Schema.String,
  dialog: Schema.NullOr(Dialog),
  offer: Schema.NullOr(Offer),
  rearranged: Schema.NullOr(Rearranged)
})
export type Model = typeof Model.Type
