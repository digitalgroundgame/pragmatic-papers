import { describe, expect, it, vi } from "vitest"

import { triggerFn } from "@/blocks/Footnote/shortcutFeature.client"

vi.mock("@payloadcms/richtext-lexical/client", async () => {
  const { createCommand } = await import("@payloadcms/richtext-lexical/lexical")
  return {
    $createInlineBlockNode: vi.fn(),
    $isInlineBlockNode: () => false,
    createClientFeature: (feature: unknown) => feature,
    INSERT_INLINE_BLOCK_COMMAND: createCommand("INSERT_INLINE_BLOCK_COMMAND"),
  }
})

describe("triggerFn", () => {
  const editor = {} as Parameters<typeof triggerFn>[1]

  it("opens the footnote menu straight after a word", () => {
    expect(triggerFn("a word[^", editor)).toEqual({
      leadOffset: 6,
      matchingString: "",
      replaceableString: "[^",
    })
  })

  it("opens it after a space, as before", () => {
    expect(triggerFn("a word [^Ibid", editor)).toEqual({
      leadOffset: 7,
      matchingString: "Ibid",
      replaceableString: "[^Ibid",
    })
  })

  it("stays closed once the footnote is closed with ]", () => {
    expect(triggerFn("a word[^Ibid]", editor)).toBeNull()
  })

  it("stays closed for a bracket without ^", () => {
    expect(triggerFn("a word [", editor)).toBeNull()
  })
})
