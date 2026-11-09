import { Schema } from "effect"
import { Character } from "../../domain/Character.ts"

export const CharacterId = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(64)),
  Schema.brand("CharacterId")
)
export type CharacterId = typeof CharacterId.Type

export const SavedCharacter = Schema.Struct({ character: Character, deleted: Schema.Boolean })
export type SavedCharacter = typeof SavedCharacter.Type
