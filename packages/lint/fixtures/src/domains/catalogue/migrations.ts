const sql = (strings: TemplateStringsArray) => strings.join("")

export const migrations = {
  "2026101910_shipped": sql`UPDATE catalogue_habits SET tracked_since = substr(created_at, 1, 10)`,
  "2026102100_new": sql`UPDATE catalogue_habits SET tracked_since = date(created_at)`,
  "2026102101_fine": sql`UPDATE catalogue_habits SET make_up = 1`
}
