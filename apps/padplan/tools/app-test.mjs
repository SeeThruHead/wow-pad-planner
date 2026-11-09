import { chromium } from "playwright-core"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const url = process.env.APP_URL || "http://localhost:3002/"
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/chromium" })
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true })
const page = await context.newPage()
const errors = []
page.on("pageerror", (error) => errors.push(error.message))
const texts = async (selector, expected) => {
  await page
    .waitForFunction(
      ({ selector, expected }) =>
        JSON.stringify([...document.querySelectorAll(selector)].map((node) => node.innerText)) ===
        JSON.stringify(expected),
      { selector, expected },
      { timeout: 5000 }
    )
    .catch(() => {})
  return page.locator(selector).allInnerTexts()
}
const step = async (name, run) => {
  await run()
  console.log(`ok  ${name}`)
}

const legacyPlan = JSON.parse(readFileSync(new URL("./fixtures/old-plan.json", import.meta.url), "utf8"))
await page.addInitScript((plan) => {
  if (localStorage.getItem("seeded")) return
  localStorage.setItem("seeded", "1")
  localStorage.setItem(
    "wow-pad-planner:v2",
    JSON.stringify({
      layouts: [
        { id: "layout-1", plan: { ...plan, name: "Warlock starter (my copy)" } },
        { id: "layout-2", plan: { ...plan, name: "Raid (copy)" } }
      ],
      currentId: "layout-1"
    })
  )
}, legacyPlan)
await page.goto(url)

await step("old saved layouts become a character with clean layout names", async () => {
  await page.waitForSelector(".character-card:not(.new)")
  await page.waitForLoadState("networkidle")
  assert.equal(await page.locator(".character-card:not(.new)").count(), 1)
  assert.match(await page.locator(".character-card").first().innerText(), /My Warlock/)
  await page.locator(".character-card").first().click()
  assert.deepEqual(await texts("#tabs .tab", ["★ Warlock starter", "Raid"]), ["★ Warlock starter", "Raid"])
  assert.equal((await page.locator("#stage .slot").count()) >= 28, true)
})

await step("a new layout starts from a preset and shows as a tab", async () => {
  await page.locator("#new-layout").click()
  await page.locator("#dialog-name").fill("Dungeons")
  await page.selectOption("#dialog-start", "builtin:shane-60")
  await page.locator("#dialog-confirm").click()
  assert.deepEqual(await texts("#tabs .tab", ["★ Warlock starter", "Raid", "Dungeons"]), [
    "★ Warlock starter",
    "Raid",
    "Dungeons"
  ])
  assert.deepEqual(await texts("#tabs .tab.on", ["Dungeons"]), ["Dungeons"])
  assert.equal(await page.locator("#stage .slot.back").count(), 16)
})

await step("marking a layout active moves the star, and the file holds the active layout", async () => {
  await page.locator("#make-active").click()
  assert.deepEqual(await texts("#tabs .tab.on", ["★ Dungeons"]), ["★ Dungeons"])
  await page.selectOption("#autoload", "auto")
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#save-wow").click()])
  const text = Buffer.concat(await (await download.createReadStream()).toArray()).toString()
  assert.match(text, /\["My Warlock"\] = \{\n {6}autoload = "auto",/)
  assert.match(text, /name = "Dungeons"/)
})

await step("turning on back buttons offers to optimize into a new tab, with a preview and Undo", async () => {
  await page.locator("#tabs .tab", { hasText: "Raid" }).click()
  await texts("#tabs .tab.on", ["Raid"])
  await page.selectOption("#controller-pick", "steam")
  await page.waitForSelector("#use-back:not([disabled])")
  await page.locator("#use-back").check()
  await page.waitForSelector("#offer")
  const moves = await page.locator("#offer-moves li").allInnerTexts()
  assert.match(moves[0] ?? "", /: RT \+ X \(set 1\) \u2192 No trigger \+ L4/)
  await page.locator("#offer-yes").click()
  assert.deepEqual(await texts("#tabs .tab.on", ["Raid (back buttons)"]), ["Raid (back buttons)"])
  assert.equal((await page.locator("#stage .slot.back[aria-label*=': empty']").count()) < 16, true)
  await page.locator("#undo-rearrange").click()
  assert.deepEqual(await texts("#tabs .tab.on", ["Raid"]), ["Raid"])
  assert.equal(await page.locator("#tabs .tab", { hasText: "(back buttons)" }).count(), 0)
})

await step("switching to a controller without back buttons offers to keep those spells", async () => {
  await page.locator("#tabs .tab", { hasText: "Dungeons" }).click()
  await texts("#tabs .tab.on", ["★ Dungeons"])
  await page.selectOption("#controller-pick", "xbox")
  await page.waitForSelector("#offer")
  assert.equal(await page.locator("#offer-moves li").count(), 16)
  await page.locator("#offer-yes").click()
  assert.deepEqual(await texts("#tabs .tab.on", ["Dungeons (no back buttons)"]), ["Dungeons (no back buttons)"])
})

await step("characters are created, edited and deleted from the character screen", async () => {
  await page.locator("#characters").click()
  await page.locator("#new-character").click()
  await page.locator("#dialog-name").fill("Banky")
  await page.selectOption("#dialog-class", "ROGUE")
  await page.locator("#dialog-level").fill("20")
  await page.locator("#dialog-realm").fill("Seethruhead")
  await page.locator("#dialog-confirm").click()
  assert.match(await page.locator(".character-name").innerText(), /Banky/)
  await page.locator("#characters").click()
  assert.equal((await texts(".character-card:not(.new) .character-card-name", ["My Warlock", "Banky"])).length, 2)
  await page.locator(".character-card", { hasText: "Banky" }).locator(".character-card-edit").click()
  await page.locator("#dialog-delete").click()
  assert.equal((await texts(".character-card:not(.new) .character-card-name", ["My Warlock"])).length, 1)
})

await step("everything survives a reload", async () => {
  await page.reload()
  await page.waitForSelector(".character-card")
  await page.locator(".character-card").first().click()
  assert.deepEqual(await texts("#tabs .tab", ["Warlock starter", "Raid", "★ Dungeons", "Dungeons (no back buttons)"]), [
    "Warlock starter",
    "Raid",
    "★ Dungeons",
    "Dungeons (no back buttons)"
  ])
})

await step("no page errors", async () => assert.deepEqual(errors, []))
await browser.close()
