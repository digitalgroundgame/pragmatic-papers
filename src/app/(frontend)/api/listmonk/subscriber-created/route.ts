import { render } from "@react-email/render"
import { type NextRequest } from "next/server"
import { getPayload } from "payload"

import configPromise from "@payload-config"
import {
  NEWSLETTER_TAG,
  parseDayFromTag,
  parseVolumeFromTag,
} from "@/collections/Volumes/endpoints/scheduleNewsletter/helpers"
import { MidDripWelcomeEmail } from "@/emails/MidDripWelcome"
import type { Article, Volume } from "@/payload-types"
import { formatAuthors } from "@/utilities/formatAuthors"
import { getServerSideURL } from "@/utilities/getURL"
import { listScheduledCampaigns, sendTransactional } from "@/utilities/listmonk"

/**
 * Webhook from Listmonk fired when a subscriber confirms (double-opt-in).
 *
 * If a Volume drip is currently mid-flight (some days sent, some scheduled),
 * sends the new subscriber a one-off welcome email with links to the articles
 * they missed in the current Volume. Otherwise no-op — they'll get the next
 * Volume from Day 1 with everyone else.
 *
 * Auth: shared secret in `X-Webhook-Secret` header (configured on the
 * Listmonk webhook itself).
 *
 * Expected payload (Listmonk subscriber webhook):
 *   { subscriber: { email: string, ... }, ... }
 */
export async function POST(req: NextRequest): Promise<Response> {
  const expected = process.env.LISTMONK_WEBHOOK_SECRET
  if (!expected) {
    console.error("[newsletter] LISTMONK_WEBHOOK_SECRET not configured")
    return new Response("Server misconfigured", { status: 500 })
  }
  if (req.headers.get("x-webhook-secret") !== expected) {
    return new Response("Unauthorized", { status: 401 })
  }

  let body: { subscriber?: { email?: string } }
  try {
    body = (await req.json()) as { subscriber?: { email?: string } }
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }
  const email = body.subscriber?.email
  if (!email) return new Response("Missing subscriber.email", { status: 400 })

  const scheduled = await listScheduledCampaigns()
  if (scheduled.length === 0) {
    // No drip in flight; nothing to backfill. They'll catch the next Volume's Day 1.
    return Response.json({ ok: true, action: "no-active-drip" })
  }

  // Read identity from the campaign's admin tags (vol-<N>, day-<K>) rather than
  // its display name — the scheduler owns both, but only the tags are a stable
  // contract. Group by Volume, find the currently-active one (the Volume with
  // the soonest scheduled send).
  const parsed = scheduled
    .map((c) => {
      if (!c.tags.includes(NEWSLETTER_TAG)) return null
      let volumeNumber: number | null = null
      let dayNumber: number | null = null
      for (const tag of c.tags) {
        const v = parseVolumeFromTag(tag)
        if (v !== null) volumeNumber = v
        const d = parseDayFromTag(tag)
        if (d !== null) dayNumber = d
      }
      if (volumeNumber === null || dayNumber === null) return null
      return {
        volumeNumber,
        dayIndex: dayNumber - 1,
        sendAt: c.sendAt,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime())

  if (parsed.length === 0) {
    return Response.json({ ok: true, action: "no-recognizable-campaigns" })
  }

  const first = parsed[0]!
  const activeVolumeNumber = first.volumeNumber
  const remainingDays = parsed
    .filter((p) => p.volumeNumber === activeVolumeNumber)
    .map((p) => p.dayIndex)
  const minRemainingDay = Math.min(...remainingDays)

  if (minRemainingDay === 0) {
    // No days have been sent yet for this Volume; subscriber will get Day 1 next.
    return Response.json({ ok: true, action: "drip-not-started" })
  }

  const payload = await getPayload({ config: configPromise })
  const volRes = await payload.find({
    collection: "volumes",
    where: { volumeNumber: { equals: activeVolumeNumber } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })
  const volume = volRes.docs[0] as Volume | undefined
  if (!volume) {
    return Response.json({ ok: true, action: "volume-not-found" })
  }
  const articles = (volume.articles ?? []).filter(
    (a): a is Article => typeof a === "object" && a !== null,
  )
  const alreadySent = articles.slice(0, minRemainingDay)
  const remainingCount = articles.length - alreadySent.length

  if (alreadySent.length === 0) {
    return Response.json({ ok: true, action: "nothing-to-backfill" })
  }

  const html = await render(
    MidDripWelcomeEmail({
      volume: { title: volume.title, volumeNumber: volume.volumeNumber, slug: volume.slug ?? "" },
      alreadySent: alreadySent.map((a) => {
        const firstAuthorImage = a.populatedAuthors?.[0]?.profileImage
        return {
          title: a.title,
          slug: a.slug ?? "",
          heroImageUrl:
            typeof a.heroImage === "object" && a.heroImage
              ? (a.heroImage.sizes?.square?.url ?? null)
              : null,
          authorsText:
            a.populatedAuthors && a.populatedAuthors.length > 0
              ? formatAuthors(a.populatedAuthors)
              : null,
          avatarUrl:
            firstAuthorImage && typeof firstAuthorImage !== "number"
              ? (firstAuthorImage.sizes?.square?.url ?? null)
              : null,
        }
      }),
      remainingCount,
      siteUrl: getServerSideURL(),
    }),
  )

  await sendTransactional({
    email,
    subject: `Welcome — you're joining Volume ${volume.volumeNumber} in progress`,
    bodyHtml: html,
  })

  return Response.json({
    ok: true,
    action: "welcome-sent",
    backfilledArticles: alreadySent.length,
    remaining: remainingCount,
  })
}

export const dynamic = "force-dynamic"
