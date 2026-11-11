import { Schema } from "effect"

export const toJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown))

export const toPrettyJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown, { space: 2 }))
