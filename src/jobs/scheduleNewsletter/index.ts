import { render } from "@react-email/render"
import type { TaskConfig } from "payload"

import { VolumeArticleEmail } from "@/emails/VolumeArticle"
import type { Article, Volume } from "@/payload-types"
import { getServerSideURL } from "@/utilities/getURL"
import { createScheduledCampaign, listScheduledCampaigns } from "@/utilities/listmonk"
import {
  articleTag,
  campaignName,
  NEWSLETTER_TAG,
  nextWeekday7amET,
  parseArticleIdFromTag,
  volumeTag,
} from "./schedule"

export const scheduleNewsletterTask: TaskConfig<"scheduleNewsletter"> = {
  slug: "scheduleNewsletter",
  label: "Schedule Volume newsletter campaigns",
  retries: { attempts: 3, backoff: { type: "exponential", delay: 30_000 } },
  inputSchema: [{ name: "volumeId", type: "number", required: true }],
  outputSchema: [{ name: "count", type: "number", required: true }],
  handler: async ({ input, req }) => {
    const { payload } = req
    const log = payload.logger
    const { volumeId } = input as { volumeId: number }

    log.info(`[newsletter] === scheduling campaigns for volume id=${volumeId} ===`)

    const volume = (await payload.findByID({
      collection: "volumes",
      id: volumeId,
      depth: 2,
      overrideAccess: true,
    })) as Volume

    const articles = (volume.articles ?? []).filter(
      (a): a is Article =>
        typeof a === "object" && a !== null && (a as Article)._status === "published",
    )

    if (articles.length === 0) {
      log.warn(`[newsletter] volume ${volumeId} has no published articles; nothing to schedule`)
      return { output: { count: 0 } }
    }

    const existingCampaigns = await listScheduledCampaigns()
    // Idempotency by Listmonk campaign tags. Each campaign carries:
    //   - NEWSLETTER_TAG (so we ignore anything not created by us)
    //   - vol-<N>          (scope to this Volume)
    //   - art-<articleId>  (the actual idempotency key)
    // Tags are admin-only metadata in Listmonk — never sent to recipients.
    const thisVolumeTag = volumeTag(volume.volumeNumber)
    const existingArticleIds = new Set<number>()
    for (const c of existingCampaigns) {
      if (!c.tags.includes(NEWSLETTER_TAG)) continue
      if (!c.tags.includes(thisVolumeTag)) continue
      for (const tag of c.tags) {
        const articleId = parseArticleIdFromTag(tag)
        if (articleId !== null) existingArticleIds.add(articleId)
      }
    }

    // Baseline = latest existing send across the entire list, or now if nothing
    // is queued. Honors the queue overlap policy: a new Volume's day-1 lands
    // the weekday after whatever's currently scheduled.
    const now = new Date()
    const latestAny = existingCampaigns.reduce<Date | null>(
      (acc, c) => (!acc || c.sendAt > acc ? c.sendAt : acc),
      null,
    )
    const baseline = latestAny && latestAny > now ? latestAny : now
    log.info(
      `[newsletter] baseline = ${baseline.toISOString()} (existing campaigns on list: ${existingCampaigns.length}, this volume: ${existingArticleIds.size})`,
    )

    const siteUrl = getServerSideURL()
    let cursor = baseline
    let count = 0
    // Scheduling is append-only: existing campaigns keep their send_at, new
    // articles get appended after `baseline`. Cursor only advances on actual
    // create — skipped iterations don't burn calendar days. Day number shown
    // to subscribers = (existing already-scheduled) + (new this run).
    for (const article of articles) {
      if (existingArticleIds.has(article.id)) {
        log.info(
          `[newsletter]   article #${article.id} "${article.title}" already scheduled — skip`,
        )
        continue
      }
      cursor = nextWeekday7amET(cursor)
      const sendDayIndex = existingArticleIds.size + count // 0-based
      const name = campaignName(volume.volumeNumber, sendDayIndex, articles.length, article.title)
      const bodyHtml = await render(
        VolumeArticleEmail({
          article,
          volume: {
            title: volume.title,
            volumeNumber: volume.volumeNumber,
            slug: volume.slug ?? "",
          },
          dayIndex: sendDayIndex + 1,
          totalDays: articles.length,
          siteUrl,
        }),
      )
      const id = await createScheduledCampaign({
        name,
        subject: article.title,
        bodyHtml,
        sendAt: cursor.toISOString(),
        tags: [NEWSLETTER_TAG, thisVolumeTag, articleTag(article.id)],
      })
      log.info(
        `[newsletter]   day ${sendDayIndex + 1}: created campaign #${id} for article #${article.id} send_at=${cursor.toISOString()}`,
      )
      count++
    }

    log.info(`[newsletter] === done — created ${count} campaigns for volume ${volumeId} ===`)
    return { output: { count } }
  },
}
