import * as stylex from "@stylexjs/stylex"
import type { HtmlBuilder } from "foldkit/html"
export const styles = stylex.create({ a: { color: "red" } })
export const view = (h: HtmlBuilder<never>) => h.div([], [])
export const child = (h: HtmlBuilder<never>) => h.submodel
