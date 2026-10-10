import type React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/components/Logo/AnimatedLogo", () => ({
  // The real one pulls in the player and a 76KB animation, neither of which this is about.
  AnimatedLogo: () => null,
}))

const { experiment } = vi.hoisted(() => ({ experiment: { feed: false } }))

vi.mock("@/globals/SiteSettings/isExperimentEnabled", () => ({
  isExperimentEnabled: async (name: string) => name === "feed" && experiment.feed,
}))
vi.mock("@/data/globals", () => ({
  getGlobal: async (slug: string) =>
    slug === "header" ? { navItems: [], actions: [] } : { socials: [] },
}))

const { Header } = await import("../Component")

/** Every element in the tree Header returns, without rendering its children. */
function elements(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== "object" || !("props" in node)) return []
  const el = node as React.ReactElement<Record<string, unknown>>
  return [el, ...elements(el.props.children as React.ReactNode)]
}

const feedLinks = async () => elements(await Header()).filter((el) => el.props.href === "/feed")

describe("Header feed button", () => {
  beforeEach(() => {
    experiment.feed = false
  })

  it("isn't there while the feed experiment is off", async () => {
    expect(await feedLinks()).toHaveLength(0)
  })

  it("links to the feed while the experiment is on", async () => {
    experiment.feed = true
    const [link] = await feedLinks()
    expect(link?.props["aria-label"]).toBe("Feed")
  })
})
