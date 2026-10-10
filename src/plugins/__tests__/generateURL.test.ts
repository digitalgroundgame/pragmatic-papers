import type { CollectionConfig } from "payload"
import { getSiteURL } from "@/utilities/getURL"
import { describe, expect, it } from "vitest"
import { generateURL } from "../index"

type Args = Parameters<typeof generateURL>[0]

const urlFor = (collection: string | undefined, slug?: string) =>
  generateURL({
    collectionConfig: collection ? ({ slug: collection } as CollectionConfig) : undefined,
    doc: { slug },
  } as Args)

describe("generateURL", () => {
  const site = getSiteURL()

  it.each([
    ["articles", "on-pragmatism", "/articles/on-pragmatism"],
    ["volumes", "3", "/volumes/3"],
    ["topics", "economics", "/topics/economics"],
    ["interactives", "federal-courts", "/interactives/federal-courts"],
    ["pages", "about", "/about"],
  ])("puts %s under their own path", async (collection, slug, path) => {
    expect(await urlFor(collection, slug)).toBe(`${site}${path}`)
  })

  it("serves the home page at the site root", async () => {
    expect(await urlFor("pages", "home")).toBe(site)
  })

  it("falls back to the site root without a slug", async () => {
    expect(await urlFor("articles")).toBe(site)
  })
})
