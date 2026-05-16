import type { Article, Topic } from "@/payload-types"
import type { CollectionAfterReadHook } from "payload"

// The search reindex handler fetches docs at depth: 0, leaving `topics` as
// plain IDs. This hook ensures `topics` is always an array of full Topic
// objects so downstream consumers (e.g. beforeSync) can read `.name`.
export const populateTopics: CollectionAfterReadHook<Article> = async ({
  doc,
  req: { payload, context },
}) => {
  if (context.skipAfterRead) return doc
  if (!doc.topics || !doc.topics.length) return doc
  if (doc.topics.every((t) => typeof t === "object" && t !== null)) return doc

  const topicIds = doc.topics.map((t) => (typeof t === "number" ? t : (t as Topic).id))

  try {
    const { docs: topicDocs } = await payload.find({
      collection: "topics",
      where: { id: { in: topicIds } },
      depth: 0,
      overrideAccess: true,
    })

    const topicMap = new Map(topicDocs.map((t) => [t.id, t]))
    doc.topics = topicIds.map((id) => topicMap.get(id)).filter((t): t is Topic => Boolean(t))
  } catch (error) {
    payload.logger.error({ err: error, topicIds, articleId: doc.id }, "Failed to populate topics")
  }

  return doc
}
