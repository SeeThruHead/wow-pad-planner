import { Schema } from "effect"
import raw from "./catalog.json" with { type: "json" }
import type { ClassId } from "./Plan.ts"

export const Spell = Schema.Struct({
  name: Schema.String,
  id: Schema.NullOr(Schema.Int),
  level: Schema.Int,
  icon: Schema.NullOr(Schema.String),
  talent: Schema.Boolean,
  aliases: Schema.Array(Schema.String),
  kind: Schema.Literals(["spell", "macro", "item"]),
  desc: Schema.String,
  about: Schema.optionalKey(Schema.String)
})
export type Spell = typeof Spell.Type

const ClassCatalog = Schema.Struct({
  name: Schema.String,
  color: Schema.String,
  spells: Schema.Array(Spell),
  macros: Schema.Array(Spell)
})
export type ClassCatalog = typeof ClassCatalog.Type

export const CatalogData = Schema.Struct({
  classes: Schema.Record(Schema.String, ClassCatalog),
  shared: Schema.Array(Spell)
})
export type CatalogData = typeof CatalogData.Type

export const catalog: CatalogData = Schema.decodeUnknownSync(CatalogData)(raw)

export const classCatalog = (className: ClassId): ClassCatalog =>
  catalog.classes[className] ?? { name: className, color: "#ffffff", spells: [], macros: [] }

export const classSpells = (className: ClassId): ReadonlyArray<Spell> => {
  const data = classCatalog(className)
  return [...data.spells, ...data.macros, ...catalog.shared]
}

export const lookup = (className: ClassId, name: string): Spell | undefined =>
  classSpells(className).find((spell) => spell.name === name)
