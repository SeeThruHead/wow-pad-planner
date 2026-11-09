import { chromium } from "playwright-core"
import { mkdirSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"

const out = resolve(process.argv[2] || "reference")
mkdirSync(out, { recursive: true })
const url = process.env.PAGE_URL || pathToFileURL(resolve("dist/wow-pad-planner.html")).href
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/chromium" })

const open = async (width, height) => {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.goto(url)
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }" })
  return page
}

const shot = async (page, name, target) => {
  const path = `${out}/${name}.png`
  if (target) await page.locator(target).screenshot({ path })
  if (!target) await page.screenshot({ path, fullPage: true })
  console.log(name)
}

const desktop = await open(1400, 900)
await shot(desktop, "desktop-full")
const starters = await desktop.locator("#layout-pick option").evaluateAll((options) => options.map((option) => option.value).filter((value) => value.startsWith("builtin:")))
for (const id of starters) {
  await desktop.selectOption("#layout-pick", id)
  await shot(desktop, `stage-${id.slice(8)}`, ".stage-wrap")
}
await desktop.selectOption("#layout-pick", "builtin:shane-60")
await shot(desktop, "editor-shane-60", "section > .panel:nth-of-type(2)")
await desktop.locator("#sets button").nth(1).click()
await shot(desktop, "stage-shane-60-set2", ".stage-wrap")
await desktop.locator("#sets button").nth(0).click()
await desktop.locator("#stage .slot.back").first().hover()
await shot(desktop, "tooltip-back-slot", "body")
await desktop.locator("#stage .slot.locked").first().hover()
await shot(desktop, "tooltip-face", "body")
await desktop.mouse.move(0, 0)
await desktop.locator("#stage .slot[aria-label^='RT + B']").click()
await shot(desktop, "details-selected", "#details")
for (const panel of ["#wow", "#sharing", ".controls", ".howto", "aside"]) {
  await shot(desktop, `panel-${panel.replace(/[^\w]/g, "")}`, panel)
}
await desktop.selectOption("#controller-pick", "edge")
await shot(desktop, "stage-edge-copy", ".stage-wrap")

const phone = await open(390, 844)
await shot(phone, "phone-full")

await browser.close()
