import { type Volume } from "@/payload-types"
import { type CollectionAfterChangeHook } from "payload"

/**
 * On a Volume's first publish, enqueue the scheduleNewsletter job. The job
 * creates one scheduled Listmonk campaign per article (7am ET, weekdays only,
 * queued behind any in-flight previous Volume).
 *
 * "First publish" matches the pattern used by pushToWebhooks: previous draft →
 * current published, and no prior publishedAt timestamp.
 *
 * The existing `checkArticles` field validator on Volume.articles already
 * refuses publish if any article is unpublished, so we can trust that articles
 * are all published by the time we get here.
 */
export const scheduleNewsletter: CollectionAfterChangeHook<Volume> = async (args) => {
  if (
    args.previousDoc._status !== "draft" ||
    args.doc._status !== "published" ||
    args.previousDoc.publishedAt
  ) {
    return
  }

  await args.req.payload.jobs.queue({
    task: "scheduleNewsletter",
    input: { volumeId: args.doc.id },
  })

  args.req.payload.logger.info(
    `[newsletter] enqueued scheduleNewsletter for volume id=${args.doc.id} (v${args.doc.volumeNumber})`,
  )
}
