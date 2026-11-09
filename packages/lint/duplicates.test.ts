import { assert, describe, it } from "@effect/vitest"
import { duplicates, sideOf, tokens } from "./duplicates.ts"

const rule = `export const remaining = (done: number, target: number, perWeek: number): number => {
  const sessions = Math.min(perWeek, Math.floor(7 / (target + 1)))
  const left = Math.max(0, target * sessions - done)

  return left > target ? target : left
}
`

const renamed = rule.replaceAll("done", "count").replaceAll("target", "goal").replace("remaining", "leftToDo")

const literals = (names: ReadonlyArray<string>) =>
  names
    .map(
      (name) =>
        `export const ${name} = Schema.Literals(["a${name}", "b${name}", "c${name}"])\nexport type ${name} = typeof ${name}.Type`
    )
    .join("\n")
const strings = (word: string) =>
  `export const ${word} = [${Array.from({ length: 30 }, (_, n) => `"${word}${n}"`).join(", ")}]`

describe("duplicates", () => {
  it("sorts files into client, server and shared, and skips tests, stories, fixtures and markup", () => {
    assert.strictEqual(sideOf("client/pages/today/update.ts"), "client")
    assert.strictEqual(sideOf("features/log/handlers.ts"), "server")
    assert.strictEqual(sideOf("domains/tracking/Tracking.ts"), "server")
    assert.strictEqual(sideOf("framework/Outbox.ts"), "server")
    assert.strictEqual(sideOf("app/Routes.ts"), "server")
    assert.strictEqual(sideOf("domains/tracking/DayCount.ts"), "shared")
    assert.strictEqual(sideOf("kernel/Day.ts"), "shared")
    assert.isUndefined(sideOf("client/components/Box.ts"))
    assert.isUndefined(sideOf("domains/tracking/DayCount.test.ts"))
    assert.isUndefined(sideOf("tools/attribution.ts"))
  })

  it("ignores imports, local names and literal values, but not property names or object keys", () => {
    const words = tokens(
      `import { a } from "./a.ts"\nconst total = item.count + 3 + "x"\nconst shape = { name: total }`
    )

    assert.deepStrictEqual(
      words.map((token) => token.text),
      ["const", "I", "=", "I", ".", "count", "+", "N", "+", "S", "const", "I", "=", "{", "name", ":", "I", "}"]
    )
    assert.strictEqual(words[0]?.line, 2)
  })

  it("finds the same logic on two sides even with every name changed, once per side, as one stretch of lines", () => {
    const found = duplicates(
      [
        { path: "domains/tracking/Limits.ts", text: rule },
        { path: "client/pages/today/limits.ts", text: renamed },
        { path: "client/pages/today/again.ts", text: renamed }
      ],
      20
    )

    assert.deepStrictEqual(
      found.map((copy) => `${copy.path}:${copy.line}-${copy.endLine} ${copy.other}`),
      [
        "client/pages/today/again.ts:1-5 domains/tracking/Limits.ts",
        "client/pages/today/limits.ts:1-5 domains/tracking/Limits.ts",
        "domains/tracking/Limits.ts:1-5 client/pages/today/limits.ts"
      ]
    )
  })

  it("does not count data as logic: lists of strings and schema literal declarations look alike but share nothing", () => {
    assert.deepStrictEqual(
      duplicates(
        [
          { path: "domains/catalogue/Kinds.ts", text: literals(["Kind", "Verdict", "Origin", "Size"]) },
          { path: "client/pages/today/filters.ts", text: literals(["Filter", "Showing", "Page", "Table"]) },
          { path: "features/log/args.ts", text: strings("arg") },
          { path: "client/lib/names.ts", text: strings("name") }
        ],
        20
      ),
      []
    )
  })

  it("leaves copies on the same side, short matches and unchecked files alone", () => {
    assert.lengthOf(
      duplicates(
        [
          { path: "client/pages/today/limits.ts", text: rule },
          { path: "client/pages/today/again.ts", text: renamed },
          { path: "domains/tracking/Limits.test.ts", text: rule }
        ],
        20
      ),
      0
    )
    assert.lengthOf(
      duplicates(
        [
          { path: "domains/tracking/Limits.ts", text: rule },
          { path: "client/a.ts", text: rule }
        ],
        500
      ),
      0
    )
  })

  it("reports each copied stretch and each other file separately", () => {
    const other = `export const sweep = (rows: ReadonlyArray<number>, limit: number) =>
  rows.filter((row) => row > limit).map((row) => row * 2).reduce((sum, row) => sum + row, 0)
`
    const found = duplicates(
      [
        {
          path: "client/pages/today/limits.ts",
          text: `${rule}${"const pad = 1\n".repeat(30)}${other}${"const pad = 1\n".repeat(30)}${rule}`
        },
        { path: "client/pages/today/twice.ts", text: `${rule}${"const pad = 1\n".repeat(30)}${rule}` },
        { path: "domains/tracking/Limits.ts", text: rule },
        { path: "features/log/handlers.ts", text: other }
      ],
      12
    )

    assert.deepStrictEqual(
      found.filter((copy) => copy.path.startsWith("client/")).map((copy) => `${copy.path} ${copy.line} ${copy.other}`),
      [
        "client/pages/today/limits.ts 1 domains/tracking/Limits.ts",
        "client/pages/today/limits.ts 37 features/log/handlers.ts",
        "client/pages/today/limits.ts 69 domains/tracking/Limits.ts",
        "client/pages/today/twice.ts 1 domains/tracking/Limits.ts",
        "client/pages/today/twice.ts 37 domains/tracking/Limits.ts"
      ]
    )
  })
})
