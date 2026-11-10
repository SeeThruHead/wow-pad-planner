import { existsSync, readdirSync, readFileSync } from "node:fs"
import * as Path from "node:path"
import { Predicate } from "effect"
import { duplicates } from "./duplicates.ts"
import { isPureDomainModule, isServerOnlyDomainFile, isSharedService } from "./layout.ts"

type Loc = { readonly start: { readonly line: number }; readonly end: { readonly line: number } }

type Node = { readonly type: string; readonly loc: Loc; readonly parent?: Node | null }

type Position = { readonly line: number; readonly column: number }

type Report = {
  readonly node: Node
  readonly message: string
  readonly loc?: { readonly start: Position; readonly end: Position }
}

type Context = {
  readonly filename: string
  readonly report: (report: Report) => void
  readonly sourceCode: { readonly getAllComments: () => ReadonlyArray<Node> }
}

type Visitor = Readonly<Record<string, (node: Node) => void>>

type Rule = { readonly meta: { readonly type: "problem" }; readonly create: (context: Context) => Visitor }

const isNode = (value: unknown): value is Node => Predicate.hasProperty(value, "type") && Predicate.isString(value.type)

const field = (node: unknown, key: string): unknown => (Predicate.hasProperty(node, key) ? node[key] : undefined)

const nameOf = (node: unknown): string | undefined => {
  const name = field(node, "name")

  return Predicate.isString(name) ? name : undefined
}

const stringValue = (node: unknown): string | undefined => {
  const value = field(node, "value")

  return Predicate.isString(value) ? value : undefined
}

const memberParts = (
  node: unknown
): { readonly object: string | undefined; readonly property: string | undefined } => ({
  object: nameOf(field(node, "object")),
  property: nameOf(field(node, "property"))
})

const isFunction = (node: Node): boolean =>
  ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(node.type)

const rule = (create: (context: Context) => Visitor): Rule => ({ meta: { type: "problem" }, create })

const reportAll =
  (context: Context, message: string) =>
  (node: Node): void =>
    context.report({ node, message })

const posix = (file: string): string => file.split(Path.sep).join("/")

const packageSource = /\/packages\/([^/]+)\/src\/(.+)$/

const srcPath = (file: string): string | undefined => {
  const normalized = posix(Path.resolve(file))
  const inPackage = packageSource.exec(normalized)
  if (inPackage !== null) return `${inPackage[1]}/${inPackage[2]}`
  const index = normalized.lastIndexOf("/src/")

  return index === -1 ? undefined : normalized.slice(index + "/src/".length)
}

const workspacePackage = /^@sth-life\/([^/]+)(?:\/(.+))?$/

const packageTarget = (specifier: string): string | undefined => {
  const found = workspacePackage.exec(specifier)
  if (found === null) return undefined

  return `${found[1]}/${found[2] ?? "index.ts"}`
}

const rootOf = (file: string): string => {
  const normalized = posix(file)

  return normalized.slice(0, normalized.lastIndexOf("/src/") + "/src".length)
}

const duplicateWindow = 40

const sourcesUnder = (root: string) =>
  existsSync(root)
    ? readdirSync(root, { recursive: true, encoding: "utf8" })
        .filter((path) => path.endsWith(".ts"))
        .map((path) => ({ path: posix(path), text: readFileSync(Path.join(root, path), "utf8") }))
    : []

const duplicatesByRoot = new Map(
  ["src", "fixtures/src"].map((root) => {
    const absolute = posix(Path.resolve(root))

    return [absolute, Map.groupBy(duplicates(sourcesUnder(absolute), duplicateWindow), (found) => found.path)] as const
  })
)

const domainOf = (path: string | undefined): string | undefined =>
  path?.startsWith("domains/") === true ? path.split("/")[1] : undefined

const isClientFile = (path: string | undefined): boolean => path?.startsWith("client/") === true

const ownsMarkup = (path: string | undefined): boolean => {
  if (path === undefined) return true
  if (!path.startsWith("client/")) return true
  if (path.startsWith("client/components/")) return true
  if (path.startsWith("client/theme/")) return true

  return path.startsWith("client/stories/")
}

const markupAllowed = new Set(["submodel"])

const styleMethods = new Set(["create", "keyframes", "defineVars", "createTheme"])

const isTestFile = (file: string): boolean => file.endsWith(".test.ts") || posix(file).includes("/test/")

const isEntryPoint = (file: string): boolean => {
  if (srcPath(file) === "app/server.ts") return true
  if (srcPath(file) === "app/cli.ts") return true

  return /\/tools\/[^/]+\.ts$/.test(posix(file))
}

const serverOnlyTargets: ReadonlyArray<RegExp> = [
  /\/handlers\.ts$/,
  /Repo\.ts$/,
  /^framework\/(Handler|Database|Outbox|OutboxRepo|Authentication|Transport|Observability|migrations)\.ts$/,
  /^app\/(Handlers|Routes|Tools|server|migrations)\.ts$/
]

const serverOnlyPackages: ReadonlyArray<RegExp> = [
  /^bun(:|$)/,
  /^@effect\/platform-bun/,
  /^@effect\/sql/,
  /^effect\/sql/
]

const resolveTarget = (file: string, specifier: string): string | undefined =>
  specifier.startsWith(".") ? srcPath(Path.resolve(Path.dirname(file), specifier)) : packageTarget(specifier)

const isSqlImport = (specifier: string): boolean => specifier === "effect/sql" || specifier.startsWith("@effect/sql")

const mayImportSql = (file: string, path: string | undefined): boolean => {
  if (file.endsWith("Repo.ts")) return true
  if (posix(file).endsWith("/migrations.ts")) return true
  if (isTestFile(file)) return true

  return path?.startsWith("framework/") === true
}

const isServerOnly = (target: string | undefined): boolean => {
  if (target === undefined) return false
  if (isSharedService(target)) return false
  if (isServerOnlyDomainFile(target)) return true

  return serverOnlyTargets.some((pattern) => pattern.test(target))
}

const serviceBuilders = new Set(["Context", "Layer"])

const importsService = (specifier: string, names: ReadonlyArray<string>): boolean =>
  specifier === "effect" && names.some((name) => serviceBuilders.has(name))

const boundaryViolation = (file: string, specifier: string, names: ReadonlyArray<string>): string | undefined => {
  const from = srcPath(file)
  const target = resolveTarget(file, specifier)
  const fromDomain = domainOf(from)
  const targetDomain = domainOf(target)

  if (fromDomain !== undefined && targetDomain !== undefined && fromDomain !== targetDomain)
    return `domains/${fromDomain} must not import domains/${targetDomain}; put cross-domain steps in a handler`
  if (isSqlImport(specifier) && !mayImportSql(file, from))
    return "only *Repo.ts, migrations.ts and framework/ may import effect/sql"
  if (isClientFile(from) && isServerOnly(target)) return `client code must not import server code (${target})`
  if (isPureDomainModule(from ?? "") && importsService(specifier, names))
    return "a concept module holds types and pure functions; services and layers belong in the domain's service"
  if (isClientFile(from) && serverOnlyPackages.some((pattern) => pattern.test(specifier)))
    return `client code must not import ${specifier}`
  if (isClientFile(from) && specifier === "foldkit/fieldValidation")
    return "forms use @sth-life/framework/Form.ts, which takes each field's rules and messages from its domain schema"
  if (posix(file).endsWith("/handlers.ts") && /^effect\/(rpc|ai|http)/.test(specifier))
    return "handlers orchestrate domain services; transports belong in framework/ and app/"

  return undefined
}

const importedNames = (node: Node): ReadonlyArray<string> => {
  const specifiers = field(node, "specifiers")
  if (!Array.isArray(specifiers)) return []

  return specifiers.flatMap((specifier: unknown) => {
    const name = nameOf(field(specifier, "imported"))

    return name === undefined ? [] : [name]
  })
}

const checkSource = (context: Context) => (node: Node) => {
  const specifier = stringValue(field(node, "source"))
  if (specifier === undefined) return

  const message = boundaryViolation(context.filename, specifier, importedNames(node))
  if (message === undefined) return

  context.report({ node, message })
}

const testOnly = /\.(test|testing|stories)\.ts$/

const isTestCode = (filename: string): boolean => testOnly.test(filename) || filename.includes("/e2e/")

const checkTestImport = (context: Context) => (node: Node) => {
  const specifier = stringValue(field(node, "source"))
  if (specifier === undefined) return
  if (!/\.testing(\.ts)?$/.test(specifier)) return
  if (isTestCode(context.filename)) return

  context.report({ node, message: "test layers and fakes (*.testing.ts) belong only in tests and stories" })
}

const locatorMethods = /^(getBy[A-Z]\w*|locator|first|last|nth|filter)$/

const isLocator = (node: unknown): boolean => {
  if (field(node, "type") !== "CallExpression") return false
  const property = nameOf(field(field(node, "callee"), "property"))

  return property !== undefined && locatorMethods.test(property)
}

const mutatingMethods = new Set(["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"])

const isModuleName = (name: string | undefined): boolean => name !== undefined && /^[A-Z]/.test(name)

const freshValueTypes = new Set([
  "ObjectExpression",
  "ArrayExpression",
  "ArrowFunctionExpression",
  "FunctionExpression"
])

const isFreshValue = (node: unknown): boolean => isNode(node) && freshValueTypes.has(node.type)

const nestedInIf = (node: Node): boolean => {
  const parent: unknown = node.parent
  if (!isNode(parent)) return false
  if (isFunction(parent)) return false
  if (parent.type === "IfStatement" && field(parent, "alternate") === node) return nestedInIf(parent)
  if (parent.type === "IfStatement") return true

  return nestedInIf(parent)
}

const returnsOnlyEffectGen = (body: unknown): boolean => {
  if (isEffectGenCall(body)) return true
  if (!isNode(body) || body.type !== "BlockStatement") return false

  const statements = field(body, "body")
  if (!Array.isArray(statements) || statements.length !== 1) return false

  return isEffectGenCall(field(statements[0], "argument"))
}

const isEffectGenCall = (node: unknown): boolean => {
  if (!isNode(node) || node.type !== "CallExpression") return false

  const callee = memberParts(field(node, "callee"))

  return callee.object === "Effect" && callee.property === "gen"
}

const isThunkArgument = (node: Node): boolean => {
  const params = field(node, "params")
  if (!Array.isArray(params) || params.length > 0) return false

  return node.parent?.type === "CallExpression"
}

const isAsConst = (node: Node): boolean => nameOf(field(field(node, "typeAnnotation"), "typeName")) === "const"

const runtimes = new Set(["Effect", "BunRuntime", "NodeRuntime"])

const nondeterministic = new Set(["Date.now", "Math.random", "crypto.randomUUID"])

const dayFormatters = new Set(["formatIsoDate", "formatIsoDateUtc"])

const sqlDateFunctions = /\b(substr|substring|date|datetime|strftime|julianday)\s*\(/i

const ownsDays = (file: string): boolean => srcPath(file) === "kernel/Day.ts"

const shippedBefore = "2026102000"

const migrationKey = (node: unknown): string | undefined => {
  if (!isNode(node)) return undefined
  const key = field(node, "type") === "Property" ? stringValue(field(node, "key")) : undefined

  return key ?? migrationKey(field(node, "parent"))
}

const isShippedMigration = (node: unknown): boolean => {
  const key = migrationKey(node)

  return key !== undefined && /^\d{10}_/.test(key) && key < shippedBefore
}

const templateText = (node: unknown): string => {
  const quasis = field(field(node, "quasi"), "quasis")

  return Array.isArray(quasis) ? quasis.map((quasi) => textOf(field(field(quasi, "value"), "raw"))).join(" ") : ""
}

const textOf = (value: unknown): string => (Predicate.isString(value) ? value : "")

const logCalls = new Set(["log", "logTrace", "logDebug", "logInfo", "logWarning", "logError", "logFatal", "logWithLevel"])

const ownsWideEvents = (file: string): boolean => srcPath(file) === "framework/WideEvent.ts"

const servesRequests = new Set(["serve", "toWebHandler"])

const isTrue = (node: unknown): boolean => field(node, "value") === true

const disablesLogger = (options: unknown): boolean => {
  const properties = field(options, "properties")
  if (!Array.isArray(properties)) return false

  return properties.some((property) => nameOf(field(property, "key")) === "disableLogger" && isTrue(field(property, "value")))
}

const optionsOf = (node: unknown): unknown => {
  const args = field(node, "arguments")

  return Array.isArray(args) ? args[1] : undefined
}

const rules: Readonly<Record<string, Rule>> = {
  "no-loops": rule((context) => {
    const report = reportAll(context, "no loops; use Array methods, Effect.forEach or recursion")

    return {
      ForStatement: report,
      ForInStatement: report,
      ForOfStatement: report,
      WhileStatement: report,
      DoWhileStatement: report
    }
  }),

  "no-let": rule((context) => ({
    VariableDeclaration: (node) => {
      const kind = field(node, "kind")
      if (kind !== "let" && kind !== "var") return

      context.report({ node, message: "const only; no let or var" })
    }
  })),

  "no-mutation": rule((context) => ({
    CallExpression: (node) => {
      const callee = field(node, "callee")
      const parts = memberParts(callee)
      const args = field(node, "arguments")
      const first = Array.isArray(args) ? args[0] : undefined

      if (parts.object === "Object" && parts.property === "assign" && !isFreshValue(first))
        return context.report({
          node,
          message: "Object.assign onto an existing value mutates it; spread into a new object"
        })
      if (parts.property === undefined || !mutatingMethods.has(parts.property)) return
      if (isModuleName(parts.object)) return
      if (parts.property === "fill" && isLocator(field(callee, "object"))) return

      context.report({
        node,
        message: `${parts.property}() mutates in place; use a non-mutating alternative (toSorted, toReversed, spread)`
      })
    },
    AssignmentExpression: (node) => {
      if (field(field(node, "left"), "type") !== "MemberExpression") return

      context.report({ node, message: "no property assignment; build a new value" })
    },
    UpdateExpression: reportAll(context, "no ++ or --; build a new value")
  })),

  "no-comments": rule((context) => ({
    Program: () =>
      context.sourceCode.getAllComments().forEach(reportAll(context, "no comments; rationale goes in the commit or PR"))
  })),

  "no-nested-if": rule((context) => ({
    IfStatement: (node) => {
      if (!nestedInIf(node)) return

      context.report({ node, message: "no nested if; use guard clauses or a named helper" })
    }
  })),

  "no-multiline-logical": rule((context) => ({
    LogicalExpression: (node) => {
      if (node.parent?.type === "LogicalExpression") return
      if (field(node, "operator") === "??") return
      if (node.loc.start.line === node.loc.end.line) return

      context.report({
        node,
        message: "no multi-line && / || chains; move the condition into a named helper of guard clauses"
      })
    }
  })),

  "no-casts": rule((context) => ({
    TSAsExpression: (node) => {
      if (isAsConst(node)) return

      context.report({ node, message: "no casts; restructure until it typechecks" })
    },
    TSTypeAssertion: reportAll(context, "no casts; restructure until it typechecks")
  })),

  "wide-events-only": rule((context) => ({
    MemberExpression: (node) => {
      const parts = memberParts(node)
      if (parts.object !== "Effect") return
      if (!logCalls.has(parts.property ?? "")) return
      if (ownsWideEvents(context.filename)) return

      context.report({
        node,
        message:
          "log once per unit of work, at its end, through framework/WideEvent.ts; steps and errors are spans and fields, not log lines"
      })
    }
  })),

  "no-request-log": rule((context) => ({
    CallExpression: (node) => {
      const callee = memberParts(field(node, "callee"))
      if (callee.object !== "HttpRouter") return
      if (!servesRequests.has(callee.property ?? "")) return
      if (disablesLogger(optionsOf(node))) return

      context.report({
        node,
        message: "serve with { disableLogger: true }: each request is a span in Maple, never a log line"
      })
    }
  })),

  deterministic: rule((context) => ({
    NewExpression: (node) => {
      if (nameOf(field(node, "callee")) !== "Date") return

      context.report({ node, message: "use DateTime and Clock, never Date" })
    },
    MemberExpression: (node) => {
      const parts = memberParts(node)
      if (!nondeterministic.has(`${parts.object}.${parts.property}`)) return

      context.report({ node, message: "use the Clock and Crypto services so time and randomness stay deterministic" })
    }
  })),

  "days-from-clock": rule((context) => ({
    MemberExpression: (node) => {
      if (!dayFormatters.has(memberParts(node).property ?? "")) return
      if (ownsDays(context.filename)) return

      context.report({
        node,
        message: "a Day comes only from dayOf with the user's time zone and cutoff, never a UTC date"
      })
    },
    TaggedTemplateExpression: (node) => {
      if (nameOf(field(node, "tag")) !== "sql") return
      if (!sqlDateFunctions.test(templateText(node))) return
      if (isShippedMigration(node)) return

      context.report({
        node,
        message: "SQL must not turn timestamps into days; compute the Day with dayOf in TypeScript"
      })
    }
  })),

  "run-at-entry-only": rule((context) => ({
    MemberExpression: (node) => {
      const parts = memberParts(node)
      if (parts.object === undefined || !runtimes.has(parts.object)) return
      if (parts.property === undefined || !parts.property.startsWith("run")) return
      if (isEntryPoint(context.filename)) return

      context.report({ node, message: "Effect.run* and runMain belong only in src/app/server.ts, src/app/cli.ts and tools/ scripts" })
    }
  })),

  "no-gen-wrapper": rule((context) => {
    const check = (node: Node) => {
      if (isThunkArgument(node)) return
      if (!returnsOnlyEffectGen(field(node, "body"))) return

      context.report({
        node,
        message: "a function that only returns Effect.gen should be Effect.fn or Effect.fnUntraced"
      })
    }

    return { FunctionDeclaration: check, FunctionExpression: check, ArrowFunctionExpression: check }
  }),

  "markup-in-components": rule((context) => ({
    CallExpression: (node) => {
      if (ownsMarkup(srcPath(context.filename))) return
      const callee = memberParts(field(node, "callee"))
      if (callee.object === "h" && !markupAllowed.has(callee.property ?? ""))
        return context.report({ node, message: "HTML belongs in client/components; pages and apps compose components" })
      if (callee.object !== "stylex" || !styleMethods.has(callee.property ?? "")) return

      context.report({ node, message: "styles belong in client/components and client/theme" })
    }
  })),

  "shared-logic": rule((context) => ({
    Program: (node) => {
      const path = srcPath(context.filename) ?? ""
      const found = duplicatesByRoot.get(rootOf(context.filename))?.get(path) ?? []

      found.forEach((copy) =>
        context.report({
          node,
          loc: { start: { line: copy.line, column: 0 }, end: { line: copy.endLine, column: 0 } },
          message: `lines ${copy.line}-${copy.endLine} repeat ${copy.other}:${copy.otherLine}; logic the client and server share belongs once in a pure domain module both import`
        })
      )
    }
  })),

  "no-test-code-in-production": rule((context) => {
    const check = checkTestImport(context)

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check
    }
  }),

  boundaries: rule((context) => {
    const check = checkSource(context)

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check
    }
  })
}

export default { meta: { name: "house" }, rules }
