import { assert, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

const Report = Schema.fromJsonString(
  Schema.Struct({
    diagnostics: Schema.Array(
      Schema.Struct({
        code: Schema.String,
        filename: Schema.String,
        labels: Schema.Array(Schema.Struct({ span: Schema.Struct({ line: Schema.Int }) }))
      })
    )
  })
)

const expected = [
  "casts.ts house(no-casts) 1",
  "comments.ts house(no-comments) 1",
  "days.ts house(days-from-clock) 3",
  "deterministic.ts house(deterministic) 1",
  "deterministic.ts house(deterministic) 1",
  "deterministic.ts house(deterministic) 1",
  "floating-effect.ts effecttsgo(floating-effect) 4",
  "floating-effect.ts house(wide-events-only) 4",
  "gen-wrapper.ts house(no-gen-wrapper) 2",
  "let.ts house(no-let) 2",
  "logs.ts house(wide-events-only) 2",
  "loops.ts house(no-loops) 3",
  "loops.ts house(no-mutation) 3",
  "multiline-logical.ts house(no-multiline-logical) 2",
  "mutation.ts house(no-mutation) 2",
  "mutation.ts house(no-mutation) 3",
  "mutation.ts house(no-mutation) 4",
  "nested-if.ts house(no-nested-if) 3",
  "run.ts house(run-at-entry-only) 2",
  "serve.ts house(no-request-log) 3",
  "serve.ts house(no-request-log) 5",
  "src/client/pages/today/Form.ts house(boundaries) 1",
  "src/client/pages/today/Markup.ts house(markup-in-components) 3",
  "src/client/pages/today/Markup.ts house(markup-in-components) 4",
  "src/client/pages/today/TodayPage.ts house(boundaries) 1",
  "src/client/pages/today/TodayPage.ts house(boundaries) 3",
  "src/client/pages/today/TodayPage.ts house(boundaries) 4",
  "src/client/pages/today/TodayPage.ts house(boundaries) 6",
  "src/client/pages/today/limits.ts house(shared-logic) 1",
  "src/domains/catalogue/Catalogue.ts house(boundaries) 1",
  "src/domains/catalogue/Catalogue.ts house(boundaries) 2",
  "src/domains/catalogue/migrations.ts house(days-from-clock) 5",
  "src/domains/tracking/Limits.ts house(shared-logic) 1",
  "src/domains/tracking/Streak.ts house(boundaries) 2",
  "src/features/log/handlers.ts house(boundaries) 1",
  "testing-import.ts house(no-test-code-in-production) 1"
]

class NoReport extends Schema.TaggedError<NoReport, { readonly brand: unique symbol }>()("NoReport", {
  hint: Schema.String,
  stderr: Schema.String
}) {}

class Unreadable extends Schema.TaggedError<Unreadable, { readonly brand: unique symbol }>()("Unreadable", {
  cause: Schema.Defect()
}) {}

const textOf = (stream: ReadableStream<Uint8Array>) =>
  Effect.tryPromise({ try: () => new Response(stream).text(), catch: (cause) => new Unreadable({ cause }) })

const lintFixtures = Effect.gen(function* () {
  const child = Bun.spawn(
    ["./node_modules/.bin/oxlint", "--no-ignore", "-c", "fixtures.oxlintrc.json", "-f", "json", "fixtures"],
    { stdout: "pipe", stderr: "pipe" }
  )
  const [stdout, stderr] = yield* Effect.all([textOf(child.stdout), textOf(child.stderr)])

  return yield* Schema.decodeEffect(Report)(stdout).pipe(
    Effect.mapError(
      () =>
        new NoReport({
          hint: "oxlint printed no report; an unpatched oxlint has no effecttsgo plugin, run `bun run patch`",
          stderr
        })
    )
  )
})

it.effect(
  "each house rule, and the Effect rules only a patched oxlint has, report exactly the fixture lines they should, and clean code reports nothing",
  () =>
    Effect.gen(function* () {
      const report = yield* lintFixtures
      const found = report.diagnostics
        .map(
          (d) =>
            `${d.filename.replace(/^.*lint\/fixtures\//, "").replace(/^fixtures\//, "")} ${d.code} ${d.labels[0]?.span.line ?? 0}`
        )
        .toSorted()

      assert.deepStrictEqual(found, expected)
    }),
  60_000
)
