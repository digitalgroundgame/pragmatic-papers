import { expect, test } from "@playwright/test"

import {
  FOUR_AUTHOR_SLUG,
  SHOWCASE_SLUG,
  VOLUME_SLUG,
  WRITER_SLUG,
} from "../../scripts/seed-e2e.constants"
import { checkJsonLdBlock, expandJsonLd, topLevelTypes } from "./structuredData"

// Every route that renders <JsonLd>, on a page the e2e seed creates. Each
// application/ld+json block must parse, expand as JSON-LD, and carry what
// Google needs for its type (the rules live in ./structuredData.ts). Google's
// Rich Results Test stays the authoritative check, but it has no API.
const PAGES = [
  { path: "/", types: ["WebSite", "Organization", "Periodical", "BreadcrumbList"] },
  // In volume 1, so its Article points at the volume through isPartOf.
  { path: `/articles/${SHOWCASE_SLUG}`, types: ["NewsArticle", "BreadcrumbList"] },
  // Four authors, each a Person inside the Article.
  { path: `/articles/${FOUR_AUTHOR_SLUG}`, types: ["NewsArticle", "BreadcrumbList"] },
  { path: `/volumes/${VOLUME_SLUG}`, types: ["PublicationVolume", "BreadcrumbList"] },
  { path: `/contributors/${WRITER_SLUG}`, types: ["Person", "BreadcrumbList"] },
]

for (const { path, types } of PAGES) {
  test(`${path} renders valid JSON-LD`, async ({ page }) => {
    const response = await page.goto(path)
    expect(response?.status(), `${path} should answer 200`).toBe(200)

    const sources = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(sources.length, "JSON-LD blocks on the page").toBeGreaterThan(0)

    const blocks = sources.map((source, i) => {
      try {
        return JSON.parse(source)
      } catch (error) {
        throw new Error(`JSON-LD block ${i + 1} is not JSON: ${String(error)}\n${source}`)
      }
    })

    for (const block of blocks) {
      const expanded = await expandJsonLd(block)
      expect(expanded.length, "nodes left after JSON-LD expansion").toBeGreaterThan(0)

      expect(checkJsonLdBlock(block), JSON.stringify(block, null, 2)).toEqual([])
    }

    expect(topLevelTypes(blocks)).toEqual(types)
  })
}
