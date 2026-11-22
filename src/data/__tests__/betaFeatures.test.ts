import { describe, expect, it, vi } from "vitest"

vi.mock("@/data/payload", () => ({ getPayloadClient: vi.fn() }))

import { betaFeaturesOf, DEFAULT_BETA_INFO } from "../betaFeatures"

const plugin = (slug: string, beta?: { info?: string }) => ({
  slug,
  name: slug,
  source: "",
  description: "",
  collections: [],
  globals: [],
  ...(beta && { beta }),
})

const config = {
  custom: {
    registeredPlugins: [
      plugin("comments", { info: "Comments are in beta." }),
      plugin("tours", {}),
      plugin("redirects"),
    ],
  },
  globals: [
    {
      slug: "site-settings",
      fields: [
        {
          name: "experiments",
          type: "group",
          fields: [
            { name: "feed", type: "checkbox", custom: { beta: { info: "The feed is in beta." } } },
            { name: "tableOfContents", type: "checkbox" },
          ],
        },
      ],
    },
  ],
} as unknown as Parameters<typeof betaFeaturesOf>[0]

describe("betaFeaturesOf", () => {
  it("lists the plugins and experiments that say they're betas, with their notes", () => {
    expect(betaFeaturesOf(config)).toEqual({
      comments: "Comments are in beta.",
      tours: DEFAULT_BETA_INFO,
      feed: "The feed is in beta.",
    })
  })

  it("lists nothing for a config without plugins or Settings", () => {
    expect(betaFeaturesOf({})).toEqual({})
  })
})
