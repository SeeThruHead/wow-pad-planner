import { assert, describe, it } from "@effect/vitest"
import { type CoverageMap, coverageBar, everything, shortfalls, warning } from "./coverageBar.ts"

const covered = (pct: number) => ({ pct })

const map: CoverageMap = {
  files: () => ["/repo/src/b.ts", "/repo/src/a.ts"],
  fileCoverageFor: (file) => ({
    toSummary: () => ({
      data:
        file === "/repo/src/a.ts"
          ? { lines: covered(90), branches: covered(75), functions: covered(100), statements: covered(100) }
          : { lines: covered(100), branches: covered(100), functions: covered(100), statements: covered(100) }
    })
  })
}

describe("coverage bar", () => {
  it("names each file under the bar with the metrics it misses, and leaves files at the bar out", () => {
    assert.deepStrictEqual(shortfalls(map, everything, "/repo"), [
      { file: "src/a.ts", misses: ["lines 90% (bar 100%)", "branches 75% (bar 100%)"] }
    ])
  })

  it("writes one warning line per file under the bar, which CI turns into a ::warning:: annotation", () => {
    assert.strictEqual(
      warning("encode logic", shortfalls(map, everything, "/repo")),
      "WARNING coverage under the bar (encode logic): src/a.ts: lines 90% (bar 100%), branches 75% (bar 100%)\n"
    )
  })

  it("says nothing when every file reaches the bar", () => {
    assert.strictEqual(warning("encode", shortfalls(map, { ...everything, lines: 90, branches: 75 }, "/repo")), "")
  })

  it("only reads an istanbul coverage map", () => {
    const reporter = coverageBar("encode", everything)

    assert.isUndefined(reporter.onCoverage?.(undefined))
    assert.isUndefined(reporter.onCoverage?.({ files: () => [] }))
    assert.isUndefined(reporter.onCoverage?.({ fileCoverageFor: () => undefined }))
    assert.isUndefined(reporter.onCoverage?.({ files: () => [], fileCoverageFor: () => undefined }))
  })
})
