import { emptyPlan } from "../../domain/Layout.ts"
import { STARTERS } from "../../domain/Starters.ts"
import type { Plan } from "../../domain/Plan.ts"
import type { Library, Model, StoredLayout } from "./model.ts"

export const firstStarter = STARTERS[0]?.id ?? "builtin:warlock"

export const emptyLibrary = (device: string): Library => ({ layouts: [], currentId: firstStarter, device })

const fallbackPlan: Plan = emptyPlan("WARLOCK", "xbox")

export const isBuiltin = (id: string): boolean => id.startsWith("builtin:")

const starterPlan = (model: Model, id: string): Plan | undefined => {
  const starter = STARTERS.find((item) => item.id === id)
  if (!starter) return undefined
  return { ...starter.plan, activeSet: model.builtinSets[id] ?? 0 }
}

export const currentPlan = (model: Model): Plan => {
  const id = model.library.currentId
  const builtin = starterPlan(model, id)
  if (builtin) return builtin
  const saved = model.library.layouts.find((item) => item.id === id)
  return saved?.plan ?? starterPlan(model, firstStarter) ?? fallbackPlan
}

export const nextId = (library: Library): string => {
  const device = library.device ?? "local"
  const numbers = library.layouts
    .map((item) => item.id)
    .filter((id) => id.startsWith(`${device}-`))
    .map((id) => Number(id.slice(device.length + 1)) || 0)
  return `${device}-${numbers.reduce((max, value) => Math.max(max, value), 0) + 1}`
}

export const withLayout = (library: Library, layout: StoredLayout): Library => ({
  ...library,
  layouts: library.layouts.some((item) => item.id === layout.id)
    ? library.layouts.map((item) => (item.id === layout.id ? layout : item))
    : [...library.layouts, layout]
})

export const sourceStarter = (plan: Plan) =>
  STARTERS.find((starter) => plan.name.endsWith("(my copy)") && plan.name.startsWith(starter.plan.name))
