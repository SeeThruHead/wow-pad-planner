import { readFileSync } from "node:fs"
import vm from "node:vm"
const context = { window: {} }
vm.createContext(context)
vm.runInContext(readFileSync("page/controllers.js", "utf8") + readFileSync("page/starters.js", "utf8") + "; this.STARTERS = STARTERS;", context)
const catalog = JSON.parse(readFileSync("page/catalog.json", "utf8"))
const missing = context.STARTERS.flatMap(({ id, plan }) => {
  const known = new Set([...catalog.classes[plan.class].spells, ...catalog.classes[plan.class].macros, ...catalog.shared].map((spell) => spell.name))
  const refs = [...plan.sets.flatMap((set) => Object.values(set.layers).flatMap((layer) => Object.values(layer))), ...Object.values(plan.paddles).flatMap((layer) => Object.values(layer))]
  return refs.filter((entry) => !known.has(entry.ref)).map((entry) => `${id}: ${entry.ref}`)
})
console.log(missing.length ? missing.join("\n") : "all starter spells are in the catalog")
process.exit(missing.length ? 1 : 0)
