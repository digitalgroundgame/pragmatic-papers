import { render } from "@react-email/render"
import type { TaskConfig } from "payload"

import { VolumeArticleEmail } from "@/emails/VolumeArticle"
import type { Article, Volume } from "@/payload-types"
import { getServerSideURL } from "@/utilities/getURL"
import { createScheduledCampaign, listScheduledCampaigns } from "@/utilities/listmonk"
import { campaignName, campaignNameVolumePrefix, nextWeekday7amET } from "./schedule"

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
    const prefix = campaignNameVolumePrefix(volume.volumeNumber)
    const existingForThisVolume = new Set(
      existingCampaigns.filter((c) => c.name.startsWith(prefix)).map((c) => c.name),
    )

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
      `[newsletter] baseline = ${baseline.toISOString()} (existing campaigns on list: ${existingCampaigns.length}, this volume: ${existingForThisVolume.size})`,
    )

    const siteUrl = getServerSideURL()
    let cursor = baseline
    let count = 0
    for (const [i, article] of articles.entries()) {
      cursor = nextWeekday7amET(cursor)
      const name = campaignName(volume.volumeNumber, i, article.title)
      if (existingForThisVolume.has(name)) {
        log.info(`[newsletter]   day ${i + 1}: already scheduled (idempotent skip): "${name}"`)
        continue
      }
      const bodyHtml = await render(
        VolumeArticleEmail({
          article,
          volume: {
            title: volume.title,
            volumeNumber: volume.volumeNumber,
            slug: volume.slug ?? "",
          },
          dayIndex: i + 1,
          totalDays: articles.length,
          siteUrl,
        }),
      )
      const id = await createScheduledCampaign({
        name,
        subject: article.title,
        bodyHtml,
        sendAt: cursor.toISOString(),
      })
      log.info(
        `[newsletter]   day ${i + 1}: created campaign #${id} send_at=${cursor.toISOString()}`,
      )
      count++
    }

    log.info(`[newsletter] === done — created ${count} campaigns for volume ${volumeId} ===`)
    return { output: { count } }
  },
}
