import * as Path from "node:path"
import { isPureDomainModule } from "./layout.ts"

export type Source = { readonly path: string; readonly text: string }

export const newModuleLimit = 2

const importPaths = (text: string): ReadonlyArray<string> =>
  [...text.matchAll(/^\s*(?:import|export)\s[^"']*?from\s+["']([^"']+)["']/gm)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]]
  )

const ignored = (path: string): boolean => {
  if (path.endsWith(".test.ts")) return true
  if (path.endsWith(".stories.ts")) return true
  if (path.startsWith("client/sample/")) return true

  return path.startsWith("client/stories/")
}

export const consumerOf = (path: string): string | undefined => {
  const parts = path.split("/")
  if (parts[0] === "features") return `features/${parts[1]}`
  if (parts[0] === "app") return "app"
  if (parts[0] !== "client") return undefined
  if (parts[1] === "pages") return `client/pages/${parts[2]}`

  return `client/${parts[1]}`
}

const resolve = (from: string, specifier: string): string | undefined =>
  specifier.startsWith(".") ? Path.posix.normalize(Path.posix.join(Path.posix.dirname(from), specifier)) : undefined

export const fanIn = (sources: ReadonlyArray<Source>): Readonly<Record<string, ReadonlyArray<string>>> => {
  const edges = sources
    .filter((source) => !ignored(source.path))
    .flatMap((source) => {
      const consumer = consumerOf(source.path)
      if (consumer === undefined) return []

      return importPaths(source.text).flatMap((specifier) => {
        const target = resolve(source.path, specifier)

        return target !== undefined && isPureDomainModule(target) ? [{ target, consumer }] : []
      })
    })
  const targets = [...new Set(edges.map((edge) => edge.target))].toSorted()

  return Object.fromEntries(
    targets.map((target) => [
      target,
      [...new Set(edges.filter((edge) => edge.target === target).map((edge) => edge.consumer))].toSorted()
    ])
  )
}

export const verdicts = (
  found: Readonly<Record<string, ReadonlyArray<string>>>,
  baseline: Readonly<Record<string, number>>
): ReadonlyArray<string> =>
  Object.entries(found).flatMap(([module, consumers]) => {
    const allowed = baseline[module] ?? newModuleLimit
    if (consumers.length > allowed)
      return [`${module} is used by ${consumers.length} consumers (allowed ${allowed}): ${consumers.join(", ")}`]
    if (consumers.length < allowed && module in baseline)
      return [`${module} is down to ${consumers.length} consumers; lower its baseline in lint/fan-in.json`]

    return []
  })
