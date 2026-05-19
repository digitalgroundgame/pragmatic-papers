import { render } from "@react-email/render"
import { cookies } from "next/headers"
import { type NextRequest } from "next/server"
import { getPayload } from "payload"

import configPromise from "@payload-config"
import { MidDripWelcomeEmail } from "@/emails/MidDripWelcome"
import { VolumeArticleEmail } from "@/emails/VolumeArticle"
import { getServerSideURL } from "@/utilities/getURL"

import type { Article, Volume } from "@/payload-types"

/**
 * Admin-only HTML preview of the daily Volume-article email.
 *
 * URL: /email-preview/<volumeId>/<dayIndex>
 *   - volumeId: numeric Volume id
 *   - dayIndex: 0-based index into the Volume.articles list. Use "welcome" to
 *     preview the mid-drip welcome template instead.
 *
 * Renders the same HTML Listmonk will receive, so editors can spot-check
 * the template before publishing a Volume.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ volume: string; day: string }> },
): Promise<Response> {
  const { volume: volumeParam, day: dayParam } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get("payload-token")?.value
  if (!token) return new Response("Unauthorized", { status: 401 })

  const payload = await getPayload({ config: configPromise })
  const meRes = await fetch(`${getServerSideURL()}/api/users/me`, {
    headers: { Authorization: `JWT ${token}` },
    cache: "no-store",
  })
  if (!meRes.ok) return new Response("Unauthorized", { status: 401 })
  const me = (await meRes.json()) as { user?: { role?: string } }
  if (!me.user) return new Response("Unauthorized", { status: 401 })

  const volumeId = Number(volumeParam)
  if (!Number.isFinite(volumeId)) return new Response("Invalid volume id", { status: 400 })

  const vol = (await payload.findByID({
    collection: "volumes",
    id: volumeId,
    depth: 2,
    overrideAccess: true,
  })) as Volume

  const articles = (vol.articles ?? []).filter(
    (a): a is Article => typeof a === "object" && a !== null,
  )

  const siteUrl = getServerSideURL()

  if (dayParam === "welcome") {
    const alreadySent = articles.slice(0, Math.max(1, Math.floor(articles.length / 2)))
    const remainingCount = articles.length - alreadySent.length
    const html = await render(
      MidDripWelcomeEmail({
        volume: { title: vol.title, volumeNumber: vol.volumeNumber, slug: vol.slug ?? "" },
        alreadySent: alreadySent.map((a) => ({ title: a.title, slug: a.slug ?? "" })),
        remainingCount,
        siteUrl,
      }),
    )
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
  }

  const dayIndex = Number(dayParam)
  const article = articles[dayIndex]
  if (!Number.isFinite(dayIndex) || !article) {
    return new Response("Invalid day index", { status: 400 })
  }
  const html = await render(
    VolumeArticleEmail({
      article,
      volume: { title: vol.title, volumeNumber: vol.volumeNumber, slug: vol.slug ?? "" },
      dayIndex: dayIndex + 1,
      totalDays: articles.length,
      siteUrl,
    }),
  )
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
}

export const dynamic = "force-dynamic"
