import { Schema } from "effect"

export const UserId = Schema.String.pipe(Schema.brand("UserId"))
export type UserId = typeof UserId.Type

export const Nickname = Schema.Trimmed.pipe(
  Schema.check(Schema.isMinLength(2), Schema.isMaxLength(24)),
  Schema.brand("Nickname")
)
export type Nickname = typeof Nickname.Type

export const User = Schema.Struct({ id: UserId, nickname: Schema.NullOr(Nickname) })
export type User = typeof User.Type

export class Unauthenticated extends Schema.TaggedError<Unauthenticated, { readonly brand: unique symbol }>()(
  "Unauthenticated",
  { message: Schema.String }
) {}

export const signInFirst = new Unauthenticated({ message: "Sign in to save layouts to your account." })
