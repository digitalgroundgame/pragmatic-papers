// @vitest-environment node
import type { Article } from "@/payload-types"
import { describe, expect, it } from "vitest"

import { detectMathBlocks } from "../detectMathBlocks"

const content = (...children: unknown[]) =>
  ({ root: { type: "root", version: 1, children } }) as unknown as Article["content"]

const paragraph = (...children: unknown[]) => ({ type: "paragraph", version: 1, children })

const run = (data: Partial<Article>) => detectMathBlocks({ data } as never) as Partial<Article>

describe("detectMathBlocks", () => {
  it("turns math rendering on for an inline math block nested in a paragraph", () => {
    const data = {
      content: content(
        paragraph(
          { type: "text", version: 1, text: "E = " },
          { type: "inlineBlock", version: 1, fields: { blockType: "inlineMathBlock" } },
        ),
      ),
    }

    expect(run(data).enableMathRendering).toBe(true)
  })

  it("turns math rendering on for a top-level display math block", () => {
    const data = {
      content: content({ type: "block", version: 1, fields: { blockType: "displayMathBlock" } }),
    }

    expect(run(data).enableMathRendering).toBe(true)
  })

  it("turns math rendering off when the content has no math", () => {
    const data = {
      enableMathRendering: true,
      content: content(
        paragraph({ type: "text", version: 1, text: "Plain prose" }),
        { type: "block", version: 1, fields: { blockType: "mediaBlock" } },
        { type: "inlineBlock", version: 1, fields: null },
      ),
    }

    expect(run(data).enableMathRendering).toBe(false)
  })

  it("leaves the flag alone when there's no content in the update", () => {
    expect(run({ enableMathRendering: true }).enableMathRendering).toBe(true)
  })
})
