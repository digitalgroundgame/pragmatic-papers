import { describe, expect, it, vi } from "vitest"

const registered = [
  { slug: "comments", switch: { label: "Comments", description: "", defaultValue: false } },
  { slug: "sso", switch: { label: "Single sign-on", description: "", defaultValue: true } },
]
vi.mock("@/data/payload", () => ({
  getPayloadClient: vi.fn(async () => ({ config: { custom: { registeredPlugins: registered } } })),
}))

import { isPluginBeta } from "../isPluginBeta"

describe("isPluginBeta", () => {
  it("is a beta while the plugin's switch starts off", async () => {
    expect(await isPluginBeta("comments")).toBe(true)
  })

  it("isn't once its switch starts on", async () => {
    expect(await isPluginBeta("sso")).toBe(false)
  })

  it("isn't for a plugin that isn't installed", async () => {
    expect(await isPluginBeta("docs")).toBe(false)
  })
})
