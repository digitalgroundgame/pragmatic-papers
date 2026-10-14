import { render, screen } from "@testing-library/react"
import type { UIFieldServerProps } from "payload"
import { describe, expect, it, vi } from "vitest"

import type { User } from "@/payload-types"

import { PluginsField } from "../PluginsField"

vi.mock("@payloadcms/ui", () => ({
  useField: ({ path }: { path: string }) => ({
    value: path === "switches.docs",
    setValue: vi.fn(),
    disabled: false,
  }),
}))

const user = (roles: string[]) => ({ id: 1, roles }) as unknown as User
const props = (u: User | null) =>
  ({
    req: { user: u },
    payload: {
      config: {
        routes: { admin: "/admin" },
        collections: [{ slug: "search", labels: { plural: "Search" }, admin: {} }],
        globals: [],
        custom: {
          registeredPlugins: [
            {
              slug: "plugin-search",
              name: "Search",
              source: "@payloadcms/plugin-search",
              description: "Keeps a search index.",
              collections: ["search"],
              globals: [],
            },
            {
              slug: "docs",
              name: "Help docs",
              source: "src/plugins/docs",
              description: "Help docs.",
              collections: [],
              globals: [],
              switch: { label: "Help docs", description: "", defaultValue: false },
              enabled: async () => true,
            },
          ],
        },
      },
    },
  }) as unknown as UIFieldServerProps

describe("PluginsField", () => {
  it("lists the plugins this config installed", async () => {
    render(await PluginsField(props(user(["admin"]))))
    expect(screen.getByRole("row", { name: /Search/ })).toHaveTextContent(
      "@payloadcms/plugin-search",
    )
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
      "href",
      "/admin/collections/search",
    )
  })

  it("puts each plugin's switch in its Status cell", async () => {
    render(await PluginsField(props(user(["admin"]))))
    expect(screen.getByRole("switch", { name: "Help docs" })).toBeChecked()
    expect(screen.getByRole("switch", { name: "Help docs" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    )
    const fixed = screen.getByRole("switch", { name: "Search" })
    expect(fixed).toBeChecked()
    expect(fixed).toHaveAttribute("aria-disabled", "true")
  })

  it("renders nothing for anyone but admins", async () => {
    expect(await PluginsField(props(user(["editor"])))).toBeNull()
    expect(await PluginsField(props(null))).toBeNull()
  })
})
