import type { Html, HtmlBuilder } from "foldkit/html"
import { Page } from "../components/Page.ts"
import type { Message } from "./messages.ts"
import type { Model } from "./model.ts"

export const view = (model: Model, h: HtmlBuilder<Message>): Html => Page(model, h)
