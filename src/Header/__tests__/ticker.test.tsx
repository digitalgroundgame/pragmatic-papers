import type React from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/Logo/AnimatedLogo", () => ({ AnimatedLogo: () => null }))
vi.mock("@/globals/SiteSettings/isExperimentEnabled", () => ({
  isExperimentEnabled: async () => false,
}))
vi.mock("@/data/globals", () => ({
  getGlobal: async (slug: string) =>
    slug === "header" ? { navItems: [], actions: [] } : { socials: [] },
}))

const { Ticker } = await import("@/components/Ticker")
const { MegaMenu } = await import("@/components/MegaMenu")
const { Header } = await import("../Component")

type El = React.ReactElement<Record<string, unknown>>

/** Every element in the tree, without rendering its children. */
function elements(node: React.ReactNode): El[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== "object" || !("props" in node)) return []
  const el = node as El
  return [el, ...elements(el.props.children as React.ReactNode)]
}

describe("Header ticker", () => {
  it("comes after the mega menu, outside the sticky header, so it scrolls away", async () => {
    const top = (await Header()) as El
    const siblings = elements(top.props.children as React.ReactNode).filter((el) =>
      (top.props.children as React.ReactNode[]).includes(el),
    )
    expect(siblings.map((el) => el.type)).toEqual(["header", MegaMenu, Ticker])

    const header = siblings[0]!
    expect(header.props.className).toEqual(expect.stringContaining("sticky"))
    expect(elements(header.props.children as React.ReactNode).map((el) => el.type)).not.toContain(
      Ticker,
    )
  })
})
