import { classCatalog } from "../../domain/Catalog.ts"
import { activeLayout, cleanName, planFor } from "../../domain/Character.ts"
import type { Character, NamedLayout } from "../../domain/Character.ts"
import { emptyPlan } from "../../domain/Layout.ts"
import type { ClassId, Plan } from "../../domain/Plan.ts"
import { STARTERS } from "../../domain/Starters.ts"
import type { Library, Model, OldLayout } from "./model.ts"

export const emptyLibrary = (device: string): Library => ({
  characters: [],
  currentCharacterId: "",
  currentLayoutId: "",
  device
})

export const tick = (model: Model): number =>
  Math.max(model.clock, ...model.library.characters.map((character) => character.updatedAt)) + 1

const numbered = (device: string, ids: ReadonlyArray<string>, prefix: string): string => {
  const head = `${device}-${prefix}`
  const numbers = ids.filter((id) => id.startsWith(head)).map((id) => Number(id.slice(head.length)) || 0)
  return `${head}${Math.max(0, ...numbers) + 1}`
}

export const nextCharacterId = (library: Library): string =>
  numbered(
    library.device,
    library.characters.map((character) => character.id),
    "c"
  )

export const nextLayoutId = (library: Library): string =>
  numbered(
    library.device,
    library.characters.flatMap((character) => character.layouts.map((layout) => layout.id)),
    "l"
  )

export const currentCharacter = (model: Model): Character | undefined =>
  model.library.characters.find((character) => character.id === model.library.currentCharacterId)

export const currentLayout = (model: Model): NamedLayout | undefined => {
  const character = currentCharacter(model)
  if (!character) return undefined
  return character.layouts.find((layout) => layout.id === model.library.currentLayoutId) ?? activeLayout(character)
}

const fallbackPlan: Plan = emptyPlan("WARLOCK", "xbox")

export const currentPlan = (model: Model): Plan => {
  const character = currentCharacter(model)
  const layout = currentLayout(model)
  return character && layout ? planFor(character, layout) : fallbackPlan
}

export const startersFor = (className: ClassId) => STARTERS.filter((starter) => starter.plan.class === className)

export const startPlan = (className: ClassId, start: string): Plan => {
  const starter = STARTERS.find((item) => item.id === start)
  if (starter && starter.plan.class === className) return starter.plan
  return emptyPlan(className, starter?.plan.controller ?? "xbox")
}

export const withCharacter = (library: Library, character: Character): Library => ({
  ...library,
  characters: library.characters.some((item) => item.id === character.id)
    ? library.characters.map((item) => (item.id === character.id ? character : item))
    : [...library.characters, character]
})

const characterFor = (
  className: ClassId,
  layouts: ReadonlyArray<OldLayout>,
  index: number,
  device: string
): Character => {
  const named = layouts.map((layout, position) => ({
    id: `${device}-l${index * 100 + position + 1}`,
    name: cleanName(layout.plan.name),
    plan: layout.plan
  }))
  return {
    id: `${device}-c${index + 1}`,
    name: `My ${classCatalog(className).name}`,
    className,
    level: Math.max(1, ...layouts.map((layout) => layout.plan.level)),
    realm: "",
    layouts: named,
    activeLayoutId: named[0]?.id ?? "",
    updatedAt: Math.max(1, ...layouts.map((layout) => layout.updatedAt ?? 0))
  }
}

export const migrateOldLayouts = (layouts: ReadonlyArray<OldLayout>, device: string): ReadonlyArray<Character> => {
  const byClass = Map.groupBy(layouts, (layout) => layout.plan.class)
  return [...byClass].map(([className, group], index) => characterFor(className, group, index, device))
}
