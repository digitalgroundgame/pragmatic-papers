import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"
import { describe, expect, it } from "vitest"

import { headingTocLabel } from "../label"

const node = (state?: Record<string, unknown>) =>
  ({ type: "heading", ...(state && { $: state }) }) as unknown as SerializedLexicalNode

describe("headingTocLabel", () => {
  it("reads the trimmed label from the node's state", () => {
    expect(headingTocLabel(node({ tocLabel: " Short " }))).toBe("Short")
  })

  it("is undefined without state, a label, or with a blank or non-string one", () => {
    expect(headingTocLabel(node())).toBeUndefined()
    expect(headingTocLabel(node({ other: "x" }))).toBeUndefined()
    expect(headingTocLabel(node({ tocLabel: "  " }))).toBeUndefined()
    expect(headingTocLabel(node({ tocLabel: 3 }))).toBeUndefined()
  })
})
