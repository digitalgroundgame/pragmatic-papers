import type React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ContentBlock } from "@/blocks/Content/Component"
import type { Footer as FooterGlobal } from "@/payload-types"

const { footer } = vi.hoisted(() => ({ footer: { current: {} as Partial<FooterGlobal> } }))

// A marker: the blocks themselves, and the RichText behind them, have their own tests.
vi.mock("@/blocks/Content/Component", () => ({ ContentBlock: () => null }))
vi.mock("@/data/globals", () => ({
  getGlobal: async (slug: string) => (slug === "footer" ? footer.current : {}),
}))

const { Footer } = await import("../Component")

/** Every element in the tree Footer returns, without rendering its children. */
function elements(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== "object" || !("props" in node)) return []
  const el = node as React.ReactElement<Record<string, unknown>>
  return [el, ...elements(el.props.children as React.ReactNode)]
}

const contentBlock = (id: string) =>
  ({ id, blockType: "content", columns: [] }) as unknown as NonNullable<
    FooterGlobal["layout"]
  >[number]

describe("Footer", () => {
  beforeEach(() => {
    footer.current = { id: 1, navItems: [], socials: [], layout: null }
  })

  it("renders each of its Content blocks directly, in order", async () => {
    footer.current.layout = [contentBlock("a"), contentBlock("b")]
    const blocks = elements(await Footer()).filter((el) => el.type === ContentBlock)
    // Not through RenderBlocks, which would put every block's client code on every page.
    expect(blocks.map((el) => [el.key, el.props.id])).toEqual([
      ["a", "a"],
      ["b", "b"],
    ])
    expect(blocks[0]!.props).toMatchObject({ blockType: "content", columns: [] })
  })

  it("keys a block without an id by its position", async () => {
    footer.current.layout = [{ ...contentBlock("x"), id: null }]
    const [block] = elements(await Footer()).filter((el) => el.type === ContentBlock)
    expect(block!.key).toBe("0")
  })

  it("leaves the blocks' row out when there are none", async () => {
    const tree = elements(await Footer())
    expect(tree.some((el) => el.type === ContentBlock)).toBe(false)
    expect(tree.some((el) => el.props.className === "border-t pt-6")).toBe(false)
  })
})
