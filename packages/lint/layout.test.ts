import { assert, describe, it } from "@effect/vitest"
import { isPureDomainModule, isServerOnlyDomainFile } from "./layout.ts"

describe("layout", () => {
  it("a domain's service, repository, migrations and named extra services are server-only", () => {
    assert.isTrue(isServerOnlyDomainFile("domains/catalogue/Catalogue.ts"))
    assert.isTrue(isServerOnlyDomainFile("domains/catalogue/CatalogueRepo.ts"))
    assert.isTrue(isServerOnlyDomainFile("domains/catalogue/migrations.ts"))
    assert.isTrue(isServerOnlyDomainFile("domains/identity/Passwords.ts"))
    assert.isFalse(isServerOnlyDomainFile("domains/catalogue/Habit.ts"))
    assert.isFalse(isServerOnlyDomainFile("features/habits/handlers.ts"))
  })

  it("every other file directly in a domain is a pure concept module the client may share", () => {
    assert.isTrue(isPureDomainModule("domains/catalogue/Habit.ts"))
    assert.isTrue(isPureDomainModule("domains/identity/Preferences.ts"))
    assert.isFalse(isPureDomainModule("domains/tracking/Tracking.ts"))
    assert.isFalse(isPureDomainModule("domains/tracking/Entry.test.ts"))
    assert.isFalse(isPureDomainModule("client/lib/derive.ts"))
  })
})
