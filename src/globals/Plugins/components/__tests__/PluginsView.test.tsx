import { render, screen } from "@testing-library/react"
import { notFound } from "next/navigation"
import type { Payload } from "payload"
import { describe, expect, it, vi } from "vitest"

import type { User } from "@/payload-types"

import { PluginsView } from "../PluginsView"

vi.mock("@payloadcms/ui", () => ({
  Gutter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SetStepNav: () => null,
}))
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
}))

const user = (roles: string[]) => ({ id: 1, roles }) as unknown as User
const payload = {
  config: {
    routes: { admin: "/admin" },
    collections: [{ slug: "search", labels: { plural: "Search" }, admin: {} }],
    globals: [],
    custom: {
      installedPlugins: [
        {
          name: "Search",
          source: "@payloadcms/plugin-search",
          description: "Keeps a search index.",
          collections: ["search"],
          globals: [],
        },
      ],
    },
  },
} as unknown as Pick<Payload, "config">

describe("PluginsView", () => {
  it("lists the plugins this config installed", async () => {
    render(await PluginsView({ payload, user: user(["admin"]) }))
    const row = screen.getByRole("row", { name: /Search/ })
    expect(row).toHaveTextContent("@payloadcms/plugin-search")
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
      "href",
      "/admin/collections/search",
    )
  })

  it("is for admins only", async () => {
    await expect(PluginsView({ payload, user: user(["editor"]) })).rejects.toThrow("NEXT_NOT_FOUND")
    await expect(PluginsView({ payload, user: null })).rejects.toThrow("NEXT_NOT_FOUND")
    expect(notFound).toHaveBeenCalledTimes(2)
  })
})
