import { relative } from "node:path"
import type { Reporter } from "vitest/node"

const metrics = ["lines", "branches", "functions", "statements"] as const

type Metric = (typeof metrics)[number]

export type Bar = Readonly<Record<Metric, number>>

type Summary = { readonly data: Readonly<Record<Metric, { readonly pct: number }>> }

export type CoverageMap = {
  readonly files: () => ReadonlyArray<string>
  readonly fileCoverageFor: (file: string) => { readonly toSummary: () => Summary }
}

export type Shortfall = { readonly file: string; readonly misses: ReadonlyArray<string> }

const isCoverageMap = (value: unknown): value is CoverageMap => {
  if (typeof value !== "object" || value === null) return false
  if (!("files" in value) || typeof value.files !== "function") return false

  return "fileCoverageFor" in value && typeof value.fileCoverageFor === "function"
}

export const shortfalls = (map: CoverageMap, bar: Bar, root: string): ReadonlyArray<Shortfall> =>
  map
    .files()
    .toSorted()
    .map((file) => {
      const summary = map.fileCoverageFor(file).toSummary()
      const misses = metrics
        .filter((metric) => summary.data[metric].pct < bar[metric])
        .map((metric) => `${metric} ${summary.data[metric].pct}% (bar ${bar[metric]}%)`)

      return { file: relative(root, file), misses }
    })
    .filter((shortfall) => shortfall.misses.length > 0)

export const warning = (project: string, found: ReadonlyArray<Shortfall>): string =>
  found
    .map(
      (shortfall) => `WARNING coverage under the bar (${project}): ${shortfall.file}: ${shortfall.misses.join(", ")}\n`
    )
    .join("")

export const coverageBar = (project: string, bar: Bar): Reporter => ({
  onCoverage: (coverage) => {
    if (!isCoverageMap(coverage)) return
    process.stdout.write(warning(project, shortfalls(coverage, bar, process.cwd())))
  }
})

export const everything: Bar = { lines: 100, branches: 100, functions: 100, statements: 100 }
