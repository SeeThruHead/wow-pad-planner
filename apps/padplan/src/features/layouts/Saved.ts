import { Schema } from "effect"
import { Plan } from "../../domain/Plan.ts"

export const LayoutId = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(64)),
  Schema.brand("LayoutId")
)
export type LayoutId = typeof LayoutId.Type

export const Saved = Schema.Struct({ id: LayoutId, plan: Plan, updatedAt: Schema.Int, deleted: Schema.Boolean })
export type Saved = typeof Saved.Type
