type Locator = { readonly fill: (text: string) => Promise<void>; readonly first: () => Locator }
type Page = { readonly getByLabel: (name: string) => Locator; readonly locator: (selector: string) => Locator }
export const typeName = async (page: Page) => {
  await page.getByLabel("Name").fill("Vitamins")
  await page.locator("input").first().fill("Vitamins")
}
