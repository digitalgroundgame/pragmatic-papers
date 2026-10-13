import { render, screen } from "@testing-library/react"
import type { UIFieldServerProps } from "payload"
import { describe, expect, it } from "vitest"

import type { User } from "@/payload-types"

import { PluginsField } from "../PluginsField"

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

  it("renders nothing for anyone but admins", async () => {
    expect(await PluginsField(props(user(["editor"])))).toBeNull()
    expect(await PluginsField(props(null))).toBeNull()
  })
})
