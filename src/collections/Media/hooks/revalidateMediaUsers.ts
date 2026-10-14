import type { CollectionAfterChangeHook, Payload } from "payload"

import { revalidateForReaders } from "@/hooks/revalidateForReaders"
import type { Media } from "@/payload-types"
import { DOCS_CACHE_TAG } from "@/plugins/docs/revalidateDoc"
import { docPath } from "@/utilities/routes"

import { collectMediaReferences, type MediaReference } from "../references/collectMediaReferences"

/**
 * Collections whose pages Next caches (an hour, `revalidate = 3600`); the rest render per
 * request, except the home page (`HOME`), which is prerendered too.
 */
const CACHED_PAGES = new Set(["articles", "volumes"])
const HOME = "/"

async function find(
  payload: Payload,
  collection: "articles" | "volumes",
  where: Parameters<Payload["find"]>[0]["where"],
): Promise<{ id: number | string; slug?: string | null }[]> {
  const result = await payload.find({
    collection,
    where,
    select: { slug: true },
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
  })
  return result.docs
}

/**
 * The pages a picture shows on, beyond the published documents that use it: an article's
 * hero is on its volume's page, and a contributor's profile picture is on their articles'
 * bylines and those articles' volumes.
 */
async function pagesShowing(payload: Payload, references: MediaReference[]) {
  const paths = new Set<string>()
  const purgeOnly = new Set<string>()
  const tags = new Set<string>()
  const articleIds: (number | string)[] = []

  for (const ref of references) {
    if (ref.collection === "users") {
      const bylined = await find(payload, "articles", {
        authors: { equals: ref.docId },
        _status: { equals: "published" },
      })
      for (const article of bylined) {
        articleIds.push(article.id)
        if (article.slug) paths.add(`/articles/${article.slug}`)
      }
      continue
    }
    if (ref.collection === "docs") tags.add(DOCS_CACHE_TAG)
    if (ref.collection === "articles") articleIds.push(ref.docId)
    if (!ref.docSlug) continue
    const path = docPath(ref.collection, ref.docSlug)
    if (CACHED_PAGES.has(ref.collection) || path === HOME) paths.add(path)
    else purgeOnly.add(path)
  }

  if (articleIds.length) {
    const volumes = await find(payload, "volumes", { "articles.id": { in: articleIds } })
    for (const { slug } of volumes) if (slug) paths.add(`/volumes/${slug}`)
  }
  return { paths: [...paths], purgeOnly: [...purgeOnly], tags: [...tags] }
}

/** The fields readers see: the file and its sizes, where it's cropped, and the text with it. */
const SHOWN: (keyof Media)[] = ["alt", "caption", "filename", "url", "focalX", "focalY", "sizes"]

const changesWhatReadersSee = (doc: Media, previousDoc: Media | undefined): boolean =>
  SHOWN.some((field) => JSON.stringify(doc[field]) !== JSON.stringify(previousDoc?.[field]))

/**
 * Changing a picture (its alt text, caption, focal point or file) changes every published
 * page that shows it. A new upload is on no page yet, and media in use can't be deleted
 * (`protectPublishedMedia`), so only updates revalidate. Finding those pages reads all
 * published content, so a save that changes nothing readers see (a narrator, a duration)
 * skips it.
 */
export const revalidateMediaUsers: CollectionAfterChangeHook<Media> = async ({
  doc,
  previousDoc,
  operation,
  req: { payload, context },
}) => {
  if (operation !== "update" || context.disableRevalidate) return doc
  if (!changesWhatReadersSee(doc, previousDoc)) return doc
  const references = await collectMediaReferences(payload, doc.id)
  if (!references.length) return doc
  const { paths, purgeOnly, tags } = await pagesShowing(payload, references)
  // Article heroes show on the listings too; `shared` covers them on the Worker.
  revalidateForReaders(payload.logger, `media ${doc.id}`, { paths, purgeOnly, tags, shared: true })
  return doc
}
