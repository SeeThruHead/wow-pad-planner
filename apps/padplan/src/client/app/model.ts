import { Schema } from "effect"
import { Plan, SlotLocation } from "../../domain/Plan.ts"
import { User } from "../../features/account/Account.ts"

export const StoredLayout = Schema.Struct({
  id: Schema.String,
  plan: Plan,
  updatedAt: Schema.optionalKey(Schema.Int)
})
export type StoredLayout = typeof StoredLayout.Type

export const Library = Schema.Struct({
  layouts: Schema.Array(StoredLayout),
  currentId: Schema.String,
  device: Schema.optionalKey(Schema.String)
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

export const Model = Schema.Struct({
  library: Library,
  builtinSets: Schema.Record(Schema.String, Schema.Int),
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
  nicknameDraft: Schema.String
})
export type Model = typeof Model.Type
