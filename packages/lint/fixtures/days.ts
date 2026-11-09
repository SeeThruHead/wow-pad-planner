import { DateTime } from "effect"

export const utcDay = (now: DateTime.Utc) => DateTime.formatIsoDate(now)
