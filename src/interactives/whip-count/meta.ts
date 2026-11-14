import type { Metadata } from "next"

import type { Interactive } from "@/payload-types"
import { getSiteURL } from "@/utilities/getURL"

import { CARD_SIZE } from "./card"
import { loadWhipCount } from "./load"
import { headToHead, whipCountImagePath, whipCountTitle } from "./seo"

/**
 * A whip count page's metadata: the count in the title, and the generated card as its link
 * preview image, in place of the site's default. The rest is the page's (`generateMeta`).
 * Without a count to read, the page's metadata stands as it is.
 */
export async function whipCountMeta(
  meta: Metadata,
  interactive: Pick<Interactive, "id" | "title" | "meta">,
  slug: string,
  now = new Date(),
): Promise<Metadata> {
  const count = await loadWhipCount(interactive)
  if (!count.success) return meta

  const title = whipCountTitle(interactive.meta?.title || interactive.title, count.value)
  const url = `${getSiteURL()}${whipCountImagePath(slug, count.value, now)}`
  const alt = `The whip count: ${headToHead(count.value)
    .map((c) => `${c.backs} publicly back ${c.candidate.name}`)
    .join(", ")}.`
  const image = { url, alt, ...CARD_SIZE }

  return {
    ...meta,
    title,
    openGraph: { ...meta.openGraph, title, images: [image] },
    twitter: { ...meta.twitter, card: "summary_large_image", title, images: [image] },
  }
}
