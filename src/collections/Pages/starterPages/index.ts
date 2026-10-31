import type { Payload, RequiredDataFromCollectionSlug } from "payload"

import { markSeeded, wasSeeded } from "@/utilities/seedOnce"

import { feedsPage } from "./feeds"

/**
 * Pages a release ships a first version of. A deploy creates each one once per site, as a
 * draft, and never touches it again: an editor reviews and publishes the page, and it's theirs
 * to change, or delete, from then on.
 */
export const STARTER_PAGES: readonly RequiredDataFromCollectionSlug<"pages">[] = [feedsPage]

/**
 * Creates each starter page this site has never had, as an unpublished draft. A site that
 * already has a page at its slug keeps it, and a page an editor deletes stays deleted: either
 * way the slug is remembered, so later deploys leave it alone. Run once per deploy by
 * `/next/revalidate-all`. Never throws: a page it can't create is logged, and the next deploy
 * tries again.
 */
export async function createMissingStarterPages(
  payload: Payload,
  pages: readonly RequiredDataFromCollectionSlug<"pages">[] = STARTER_PAGES,
): Promise<string[]> {
  const created: string[] = []
  for (const page of pages) {
    try {
      if (await wasSeeded(payload, "pages", page.slug)) continue

      const { totalDocs } = await payload.count({
        collection: "pages",
        where: { slug: { equals: page.slug } },
        overrideAccess: true,
      })
      if (totalDocs === 0) {
        await payload.create({
          collection: "pages",
          data: { ...page, _status: "draft" },
          draft: true,
          overrideAccess: true,
          // A draft changes nothing readers see.
          context: { disableRevalidate: true },
        })
        created.push(page.slug)
      }
      await markSeeded(payload, "pages", page.slug)
    } catch (err) {
      payload.logger.error({ err, slug: page.slug }, "Creating a starter page failed")
    }
  }
  if (created.length) payload.logger.info({ created }, "Created starter pages as drafts")
  return created
}
