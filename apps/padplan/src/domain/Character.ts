import { Schema } from "effect"
import { ClassId, Plan } from "./Plan.ts"

export const NamedLayout = Schema.Struct({ id: Schema.String, name: Schema.String, plan: Plan })
export type NamedLayout = typeof NamedLayout.Type

export const Autoload = Schema.Literals(["auto", "ask", "off"])
export type Autoload = typeof Autoload.Type

export const Character = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  className: ClassId,
  level: Schema.Int,
  realm: Schema.String,
  layouts: Schema.Array(NamedLayout),
  activeLayoutId: Schema.String,
  updatedAt: Schema.Int,
  autoload: Schema.optionalKey(Autoload)
})
export type Character = typeof Character.Type

export const planFor = (character: Character, layout: NamedLayout): Plan => ({
  ...layout.plan,
  name: layout.name,
  class: character.className,
  level: character.level
})

export const characterKey = (character: Character): string =>
  character.realm.trim() ? `${character.name.trim()}-${character.realm.trim()}` : character.name.trim()

export const activeLayout = (character: Character): NamedLayout | undefined =>
  character.layouts.find((layout) => layout.id === character.activeLayoutId) ?? character.layouts[0]

const COPY_SUFFIX = / \((my copy|copy)\)$/

export const cleanName = (name: string): string => name.replace(COPY_SUFFIX, "").replace(COPY_SUFFIX, "")
