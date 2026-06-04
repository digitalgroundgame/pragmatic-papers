import { render } from "@react-email/render"
import type { Payload } from "payload"

import { VolumeArticleEmail } from "@/emails/VolumeArticle"
import type { Article, Volume } from "@/payload-types"
import { getServerSideURL } from "@/utilities/getURL"
import {
  createScheduledCampaign,
  listScheduledCampaigns,
  updateScheduledCampaign,
  type ScheduledCampaignSummary,
} from "@/utilities/listmonk"
import {
  articleTag,
  campaignName,
  NEWSLETTER_TAG,
  nextWeekday7amET,
  parseArticleIdFromTag,
  volumeTag,
} from "./helpers"

/**
 * Schedules one Listmonk campaign per published article in a Volume.
 *
 * Behavior:
 *   - Re-runnable: an article already scheduled (matched by Listmonk tag
 *     "art-<id>") has its existing campaign's content (subject + body)
 *     refreshed in place, keeping its send_at — so editing an article and
 *     clicking again pushes the new content. New articles are created.
 *     A campaign that has already started sending (status no longer
 *     `scheduled`) is left untouched, since Listmonk forbids editing it.
 *   - Append-only: new articles always get send_at values after any existing
 *     scheduled campaigns on the list (queue-overlap policy).
 *   - 7am ET, weekdays only.
 *   - Each campaign is tagged ["newsletter", "vol-<N>", "art-<articleId>"]
 *     so admins can filter the dashboard but recipients never see them.
 *
 * Throws if Listmonk is unreachable, env config is missing, or the Volume
 * isn't found / has no published articles. The endpoint caller surfaces
 * the error to the editor's toast.
 *
 * @returns counts of newly-created and content-updated campaigns
 */
export async function scheduleVolumeNewsletter(
  payload: Payload,
  volumeId: number,
): Promise<{ created: number; updated: number }> {
  const log = payload.logger
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
    return { created: 0, updated: 0 }
  }

  const existingCampaigns = await listScheduledCampaigns()
  // Map this Volume's articles to their already-scheduled campaign via the
  // "art-<id>" tag. Tags are admin-only metadata — never sent to recipients.
  const thisVolumeTag = volumeTag(volume.volumeNumber)
  const campaignByArticleId = new Map<number, ScheduledCampaignSummary>()
  for (const c of existingCampaigns) {
    if (!c.tags.includes(NEWSLETTER_TAG)) continue
    if (!c.tags.includes(thisVolumeTag)) continue
    for (const tag of c.tags) {
      const articleId = parseArticleIdFromTag(tag)
      if (articleId !== null) campaignByArticleId.set(articleId, c)
    }
  }

  // Baseline = latest existing send across the entire list, or now if nothing
  // is queued. Honors the queue-overlap policy: a new Volume's day-1 lands
  // the weekday after whatever's currently scheduled.
  const now = new Date()
  const latestAny = existingCampaigns.reduce<Date | null>(
    (acc, c) => (!acc || c.sendAt > acc ? c.sendAt : acc),
    null,
  )
  const baseline = latestAny && latestAny > now ? latestAny : now
  log.info(
    `[newsletter] baseline = ${baseline.toISOString()} (existing campaigns on list: ${existingCampaigns.length}, this volume: ${campaignByArticleId.size})`,
  )

  const siteUrl = getServerSideURL()
  let cursor = baseline
  let created = 0
  let updated = 0
  // Day index is the article's position in the published list, so re-running
  // produces stable "Day K of N" labels regardless of create order. Send times
  // stay append-only: existing campaigns keep their send_at and the cursor only
  // advances on an actual create.
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i]!
    const name = campaignName(volume.volumeNumber, i, articles.length, article.title)
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
    const tags = [NEWSLETTER_TAG, thisVolumeTag, articleTag(article.id)]
    const existing = campaignByArticleId.get(article.id)

    if (existing) {
      // Already sending or sent — Listmonk won't let us edit it.
      if (existing.status !== "scheduled") {
        log.info(
          `[newsletter]   article #${article.id} "${article.title}" campaign #${existing.id} is "${existing.status}" — leaving as-is`,
        )
        continue
      }
      await updateScheduledCampaign({
        campaignId: existing.id,
        name,
        subject: article.title,
        bodyHtml,
        sendAt: existing.sendAt.toISOString(),
        // A PUT replaces tags wholesale, so copy the ones we fetched to avoid
        // dropping any an admin added in Listmonk. Best-effort: a tag edited
        // between the list fetch and this update would still be overwritten.
        // The identity tags (newsletter/vol-N/art-id) are always present here
        // since we matched the campaign on them.
        tags: existing.tags,
      })
      log.info(
        `[newsletter]   day ${i + 1}: updated campaign #${existing.id} content for article #${article.id}`,
      )
      updated++
      continue
    }

    cursor = nextWeekday7amET(cursor)
    const id = await createScheduledCampaign({
      name,
      subject: article.title,
      bodyHtml,
      sendAt: cursor.toISOString(),
      tags,
    })
    log.info(
      `[newsletter]   day ${i + 1}: created campaign #${id} for article #${article.id} send_at=${cursor.toISOString()}`,
    )
    created++
  }

  log.info(
    `[newsletter] === done — created ${created}, updated ${updated} campaigns for volume ${volumeId} ===`,
  )
  return { created, updated }
}
