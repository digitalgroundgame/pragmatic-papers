import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import { purgeEdgeCache } from "@/hooks/purgeEdgeCache"
import type { Page } from "../../../payload-types"
import { readersChange } from "@/utilities/readersCopy"

const pagePath = (slug: string | null | undefined): string => (slug === "home" ? "/" : `/${slug}`)

const revalidatePagePath = (slug: string | null | undefined, payload: Payload, why: string) => {
  const path = pagePath(slug)
  payload.logger.info(`Revalidating page at path: ${path}`)
  revalidatePath(path)
  revalidateTag("pages-sitemap", "max")
  purgeEdgeCache(payload.logger, `page ${slug}${why}`, { paths: [path, "/sitemap.xml"] })
}

export const revalidatePage: CollectionAfterChangeHook<Page> = async (args) => {
  const { doc, req } = args
  if (req.context.disableRevalidate) return doc
  const change = await readersChange(args)
  if (!change) return doc
  const { before, after } = change
  if (after) revalidatePagePath(after.slug, req.payload, "")
  if (before && (!after || before.slug !== after.slug)) {
    revalidatePagePath(before.slug, req.payload, after ? " renamed" : " unpublished")
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Page> = ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    const path = doc?.slug === "home" ? "/" : `/${doc?.slug}`
    revalidatePath(path)
    revalidateTag("pages-sitemap", "max")
    purgeEdgeCache(payload.logger, `page ${doc?.slug} deleted`, {
      paths: [path, "/sitemap.xml"],
    })
  }

  return doc
}
