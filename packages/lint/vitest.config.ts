import { defineConfig } from "vitest/config"
import { coverageBar, everything } from "./coverageBar.ts"

export default defineConfig({
  test: {
    name: "lint",
    include: ["*.test.ts"],
    reporters: ["default", coverageBar("lint", everything)],
    coverage: {
      enabled: true,
      provider: "istanbul",
      include: ["duplicates.ts", "coverageBar.ts"],
      reporter: ["text-summary", "json-summary"]
    }
  }
})
