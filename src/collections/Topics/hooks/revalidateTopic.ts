import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeDeleteHook,
  Payload,
} from "payload"

import { revalidateForReaders } from "@/hooks/revalidateForReaders"
import type { Topic } from "@/payload-types"

/**
 * A topic's name shows on every published article filed under it, which Next caches for an
 * hour, and on the topic's own page and the listings, which render per request (`shared`
 * covers them on the Worker). A slug change also moves the nav, which `revalidateNavLinks`
 * handles.
 */
async function articlePaths(payload: Payload, topicId: number | string): Promise<string[]> {
  const articles = await payload.find({
    collection: "articles",
    where: { topics: { equals: topicId }, _status: { equals: "published" } },
    select: { slug: true },
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
  })
  return articles.docs.map((article) => `/articles/${article.slug}`)
}

const revalidateTopic = (
  payload: Payload,
  reason: string,
  articles: string[],
  slugs: (string | null | undefined)[],
): void => {
  revalidateForReaders(payload.logger, reason, {
    paths: articles,
    purgeOnly: [...new Set(slugs.filter(Boolean))].map((slug) => `/topics/${slug}`),
    shared: true,
  })
}

const articlesKey = (id: number | string): string => `topicArticles:${id}`

export const revalidateTopicChange: CollectionAfterChangeHook<Topic> = async ({
  doc,
  previousDoc,
  operation,
  req: { payload, context },
}) => {
  // A new topic has no articles yet, and the topics index is a shared page.
  if (context.disableRevalidate) return doc
  if (operation === "create") {
    revalidateForReaders(payload.logger, `topic ${doc.slug} created`, { shared: true })
    return doc
  }
  const articles = await articlePaths(payload, doc.id)
  revalidateTopic(payload, `topic ${doc.slug}`, articles, [doc.slug, previousDoc?.slug])
  return doc
}

/** Deleting a topic drops it from its articles, so they're found before it goes. */
export const rememberTopicArticles: CollectionBeforeDeleteHook = async ({ id, req }) => {
  if (req.context.disableRevalidate) return
  const articles = await articlePaths(req.payload, id)
  req.context[articlesKey(id)] = articles
}

export const revalidateTopicDelete: CollectionAfterDeleteHook<Topic> = ({
  doc,
  id,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc
  const articles = (context[articlesKey(id)] as string[] | undefined) ?? []
  revalidateTopic(payload, `topic ${doc.slug} deleted`, articles, [doc.slug])
  return doc
}
