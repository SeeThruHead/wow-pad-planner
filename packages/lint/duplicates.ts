import { isPureDomainModule } from "./layout.ts"

export type Side = "client" | "server" | "shared"

export type Source = { readonly path: string; readonly text: string }

export type Duplicate = {
  readonly path: string
  readonly line: number
  readonly endLine: number
  readonly other: string
  readonly otherLine: number
}

type Token = { readonly text: string; readonly line: number }

type Window = { readonly path: string; readonly line: number; readonly endLine: number }

const notChecked = [/\.test\.ts$/, /\.testing\.ts$/, /\.stories\.ts$/, /^client\/(sample|stories|components|theme)\//]

export const sideOf = (path: string): Side | undefined => {
  if (notChecked.some((pattern) => pattern.test(path))) return undefined
  if (path.startsWith("client/")) return "client"
  if (path.startsWith("kernel/")) return "shared"
  if (isPureDomainModule(path)) return "shared"
  if (path.startsWith("domains/")) return "server"
  if (path.startsWith("features/")) return "server"
  if (path.startsWith("app/")) return "server"

  return path.startsWith("framework/") ? "server" : undefined
}

const tokenPattern = /[A-Za-z_$][\w$]*|\d[\d_.]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[^\s\w]/g

const keywords = new Set(
  "const return if else true false null undefined new typeof function yield async await of in export import type readonly".split(
    " "
  )
)

const normalized = (text: string, previous: string | undefined, next: string | undefined): string => {
  if (/^["'`]/.test(text)) return "S"
  if (/^\d/.test(text)) return "N"
  if (!/^[A-Za-z_$]/.test(text)) return text
  if (keywords.has(text)) return text
  if (previous === ".") return text
  if (next === ":") return text

  return "I"
}

const withoutImports = (text: string): string =>
  text.replace(/^(import|export)\s[^;]*?\sfrom\s+["'][^"']+["']\s*$/gms, (match) => match.replace(/[^\n]/g, " "))

export const tokens = (text: string): ReadonlyArray<Token> => {
  const source = withoutImports(text)
  const lineStarts = [0, ...Array.from(source.matchAll(/\n/g), (match) => match.index + 1)]
  const lineOf = (offset: number) => lineStarts.findLastIndex((start) => start <= offset) + 1

  const found = Array.from(source.matchAll(tokenPattern))

  return found.map((match, index) => ({
    text: normalized(match[0], found[index - 1]?.[0], found[index + 1]?.[0]),
    line: lineOf(match.index)
  }))
}

const logicTokens = new Set(["=>", "return", "if", "?", "&", "|", "+", "-", "*", "/", "%", "<", ">", "!"])

const hasLogic = (window: ReadonlyArray<Token>): boolean => window.some((token) => logicTokens.has(token.text))

const windowsOf = (source: Source, size: number): ReadonlyArray<readonly [string, Window]> => {
  const all = tokens(source.text)

  return all.slice(0, Math.max(0, all.length - size + 1)).flatMap((first, index) => {
    const window = all.slice(index, index + size)
    if (!hasLogic(window)) return []

    const key = window.map((token) => token.text).join(" ")
    const span: Window = {
      path: source.path,
      line: first.line,
      endLine: window.reduce((_, token) => token.line, first.line)
    }

    return [[key, span] as const]
  })
}

const merge = (found: ReadonlyArray<Duplicate>): ReadonlyArray<Duplicate> =>
  found.reduce<ReadonlyArray<Duplicate>>((merged, next) => {
    const last = merged[merged.length - 1]
    if (last === undefined) return [next]
    if (last.path !== next.path) return [...merged, next]
    if (last.other !== next.other) return [...merged, next]
    if (next.line > last.endLine) return [...merged, next]

    return [...merged.slice(0, -1), { ...last, endLine: Math.max(last.endLine, next.endLine) }]
  }, [])

export const duplicates = (sources: ReadonlyArray<Source>, size: number): ReadonlyArray<Duplicate> => {
  const checked = sources.flatMap((source) => {
    const side = sideOf(source.path)

    return side === undefined ? [] : [{ source, side }]
  })
  const sideByPath = new Map(checked.map(({ source, side }) => [source.path, side]))
  const index = Map.groupBy(
    checked.flatMap(({ source }) => windowsOf(source, size)),
    ([key]) => key
  )

  return merge(
    Array.from(index.values())
      .flatMap((entries) => {
        const windows = entries.map(([, window]) => window)

        return windows.flatMap((window) => {
          const other = windows.find((candidate) => sideByPath.get(candidate.path) !== sideByPath.get(window.path))

          return other === undefined
            ? []
            : [
                {
                  path: window.path,
                  line: window.line,
                  endLine: window.endLine,
                  other: other.path,
                  otherLine: other.line
                }
              ]
        })
      })
      .toSorted((left, right) => left.path.localeCompare(right.path) || left.line - right.line)
  )
}
