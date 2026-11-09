import { chromium } from "playwright-core"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"

const url = pathToFileURL(resolve("dist/wow-pad-planner.html")).href
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/chromium" })
const context = await browser.newContext({ viewport: { width: 1500, height: 1200 }, acceptDownloads: true })
await context.grantPermissions(["clipboard-read", "clipboard-write"])
const page = await context.newPage()
const errors = []
page.on("pageerror", (error) => errors.push(error.message))
page.on("dialog", (dialog) => dialog.accept())

const step = async (name, run) => {
  await run()
  console.log(`ok  ${name}`)
}

await page.goto(url)

await step("opens on the first starter, and Shane's preset uses four keys that work under Proton", async () => {
  assert.equal(await page.locator("#layout-name").inputValue(), "Warlock starter")
  await page.selectOption("#layout-pick", "builtin:shane")
  assert.equal(await page.locator("#layout-name").inputValue(), "Shane's level 10 Warlock (Steam Controller)")
  const steps = await page.locator("#steam-steps").innerText()
  assert.match(steps, /R4: keyboard F11/)
  assert.match(steps, /L5: keyboard F10/)
  assert.match(steps, /L4 = Backhand P1, L5 = Backhand P2, R4 = Backhand P3, R5 = Backhand P4/)
  assert.doesNotMatch(steps, /Windows only|Linux, Steam Deck and Proton/)
  assert.equal(await page.locator("#stage .slot.back[aria-label^='No trigger + R4: Shadow Bolt']").count(), 1)
})

await step("every built-in layout renders without errors", async () => {
  const ids = await page.locator("#layout-pick option").evaluateAll((options) => options.map((option) => option.value).filter((value) => value.startsWith("builtin:")))
  assert.equal(ids.length, 11)
  for (const id of ids) {
    await page.selectOption("#layout-pick", id)
    assert.equal(await page.locator("#stage .slot:not(.back)").count(), 32)
  }
  assert.deepEqual(errors, [])
})

await step("a controller without back buttons hides them and changes the glyphs", async () => {
  await page.selectOption("#layout-pick", "builtin:mage")
  assert.equal(await page.locator("#back").isHidden(), true)
  assert.match(await page.locator("#steam-steps").innerText(), /nothing to set in Steam/)
})

await step("editing a built-in layout makes a copy and leaves the built-in alone", async () => {
  await page.locator("#stage .slot[aria-label^='No trigger + D-pad up']").click({ button: "right" })
  assert.equal(await page.locator("#layout-name").inputValue(), "Mage starter (my copy)")
  assert.equal(await page.locator("#stage .slot[aria-label^='No trigger + D-pad up: empty']").count(), 1)
  await page.selectOption("#layout-pick", "builtin:mage")
  assert.equal(await page.locator("#stage .slot[aria-label^='No trigger + D-pad up: Frostbolt']").count(), 1)
})

await step("switching to a DualSense Edge shows its two back buttons and PlayStation glyphs", async () => {
  await page.selectOption("#layout-pick", { label: "Mage starter (my copy)" })
  await page.selectOption("#controller-pick", "edge")
  assert.equal(await page.locator("#back").isHidden(), true)
  await page.locator("#use-back").check()
  assert.equal(await page.locator("#back").isHidden(), false)
  assert.equal(await page.locator(".back-row").count(), 2)
  assert.equal(await page.locator("#stage .slot[aria-label^='L2 + □']").count(), 1)
})

await step("marking a back button as used elsewhere removes its slots and the clash check works", async () => {
  await page.locator(".back-row").first().locator("select[data-field=use]").selectOption("other")
  assert.equal(await page.locator("#stage .slot.back[aria-label^='No trigger + ']").count(), 1)
  await page.locator(".back-row").first().locator("select[data-field=use]").selectOption("slot")
  await page.locator(".back-row").nth(1).locator("select[data-field=key]").selectOption("F11")
  await page.locator(".back-row").first().locator("select[data-field=key]").selectOption("F11")
  assert.match(await page.locator("#steam-steps").innerText(), /Clash: LB4 and another back button both send F11/)
})

await step("the layout code imports into another planner as a new layout", async () => {
  await page.locator("#addon-code").click()
  await page.waitForFunction(() => document.getElementById("addon-code-text").value.startsWith("PADPLAN1:"))
  const code = await page.locator("#addon-code-text").inputValue()
  await page.locator("#import").click()
  await page.locator("#share-text").fill(code)
  await page.locator("#import-code").click()
  await page.waitForFunction(() => document.querySelectorAll("#layout-pick optgroup[label='My layouts'] option").length === 2)
  assert.equal(await page.locator("#layout-pick optgroup[label='My layouts'] option").count(), 2)
})

await step("buttons explain themselves on hover", async () => {
  await page.locator("#export").scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  await page.locator("#export").hover()
  assert.match(await page.locator("#tip").innerText(), /WoW doesn't read it/)
})

await step("layouts survive a reload, and rename and delete work", async () => {
  await page.reload()
  assert.equal(await page.locator("#layout-pick optgroup[label='My layouts'] option").count(), 2)
  await page.locator("#layout-name").fill("Frost mage")
  await page.locator("#layout-name").press("Enter")
  assert.equal(await page.locator("#layout-pick option", { hasText: "Frost mage" }).count(), 1)
  await page.locator("#delete").click()
  assert.equal(await page.locator("#layout-pick optgroup[label='My layouts'] option").count(), 1)
})

await step("Save for WoW writes PadPlan data with the slot back buttons in order", async () => {
  await page.selectOption("#layout-pick", "builtin:shane")
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#save-wow").click()])
  const text = await (await download.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString())
  assert.match(text, /paddleOrder = \{ "L4", "L5", "R4", "R5" \}/)
  assert.match(text, /R4 = \{ kind = "spell", id = 686, names = \{ "Shadow Bolt" \} \}/)
})

await step("mirroring the d-pad fills the back-button slots", async () => {
  await page.selectOption("#layout-pick", "builtin:warlock")
  await page.selectOption("#controller-pick", "steam")
  await page.locator("#use-back").check()
  await page.locator("#mirror").click()
  assert.equal(await page.locator("#stage .slot.back[aria-label^='No trigger + L4: Shadow Bolt']").count(), 1)
})

await step("hovering shows a tooltip with the name, level and what a spell does", async () => {
  await page.selectOption("#layout-pick", "builtin:shane")
  const slot = page.locator("#stage .slot.back[aria-label^='No trigger + R4: Shadow Bolt']")
  await slot.scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  await slot.hover()
  const tip = page.locator("#tip")
  assert.equal(await tip.isVisible(), true)
  const text = await tip.innerText()
  assert.match(text, /Shadow Bolt/)
  assert.match(text, /Learned at level 1/)
  assert.match(text, /shadowy bolt/)
  assert.match(text, /No trigger \+ R4/)
})

await step("macros show their text and what they do", async () => {
  await page.locator("#stage .slot[aria-label^='RT + B: Pet Attack']").hover()
  const text = await page.locator("#tip").innerText()
  assert.match(text, /Sends your pet to attack your target/)
  assert.match(text, /\/petattack/)
})

await step("the game's own face buttons and the target rings explain themselves", async () => {
  await page.locator("#stage .slot.locked[aria-label^='Interact']").hover()
  assert.match(await page.locator("#tip").innerText(), /Talks to, loots or uses/)
  await page.locator("#stage .ring").first().hover()
  assert.match(await page.locator("#tip").innerText(), /Friendly target/)
  await page.locator("#palette .spell", { hasText: "Fear" }).first().hover()
  assert.match(await page.locator("#tip").innerText(), /Learned at level 8/)
})

await step("a long press shows the tooltip on touch without placing anything", async () => {
  await page.mouse.move(0, 0)
  await page.locator("#palette .spell", { hasText: "Immolate" }).first().dispatchEvent("pointerdown", { pointerType: "touch" })
  await page.waitForTimeout(600)
  assert.match(await page.locator("#tip").innerText(), /Immolate/)
  await page.locator("#palette .spell", { hasText: "Immolate" }).first().dispatchEvent("pointerup", { pointerType: "touch" })
  await page.locator("#palette .spell", { hasText: "Immolate" }).first().dispatchEvent("click")
  assert.equal(await page.locator("#palette .spell.picked").count(), 0)
})

await step("the addon code and the Lua file describe the same layout", async () => {
  await page.selectOption("#layout-pick", "builtin:shane")
  await page.locator("#addon-code").click()
  await page.waitForFunction(() => document.getElementById("addon-code-text").value.startsWith("PADPLAN1:"))
  const [code, lua] = await page.evaluate(() => [addonCode(currentPlan()), toLua(currentPlan())])
  writeFileSync("dist/shane.padplan", code)
  writeFileSync("dist/shane-data.lua", lua)
})

await step("an old copy with keys Steam can't send gets a fix and a pointer to the updated built-in", async () => {
  await page.selectOption("#layout-pick", "builtin:shane")
  await page.locator("#duplicate").click()
  await page.evaluate(() => edit((plan) => ({ ...plan, name: "Shane's level 10 Warlock (Steam Controller) (my copy)", back: { ...plan.back, R4: { use: "slot", key: "F23", note: "" }, R5: { use: "slot", key: "F24", note: "" } }, why: "sends F9, F10, F23 and F24" })))
  assert.match(await page.locator("#banner").innerText(), /R4 F23, R5 F24/)
  await page.locator("#fix-keys").click()
  assert.doesNotMatch(await page.locator("#banner").innerText(), /can't send/)
  assert.match(await page.locator("#steam-steps").innerText(), /R4: keyboard F11/)
  assert.equal(await page.locator("#why").inputValue(), "sends F9, F10, F11 and F12")
  await page.locator("#open-source").click()
  assert.equal(await page.locator("#layout-name").inputValue(), "Shane's level 10 Warlock (Steam Controller)")
})

await step("no page errors", async () => assert.deepEqual(errors, []))

await browser.close()

