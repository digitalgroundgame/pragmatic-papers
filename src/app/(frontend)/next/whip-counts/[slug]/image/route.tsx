import { ImageResponse } from "next/og"
import React from "react"

import { queryInteractiveBySlug } from "@/interactives/load"
import { profileKind } from "@/interactives/profiles"
import { CARD_SIZE, WhipCountCard } from "@/interactives/whip-count/card"
import { loadCardFonts } from "@/interactives/whip-count/cardFonts"
import { loadWhipCount, whipCountUpdatedAt } from "@/interactives/whip-count/load"

interface Args {
  params: Promise<{ slug: string }>
}

/**
 * A whip count's link preview, 1200×630: the leading candidates head to head, one tick a voter,
 * the countdown and the site's mark (`WhipCountCard`). The page's metadata points at it, with
 * a query that changes with the count and the countdown's days, so the edge may keep each one a
 * day.
 */
export async function GET(_request: Request, { params }: Args): Promise<Response> {
  const { slug } = await params
  const interactive = await queryInteractiveBySlug(slug)
  if (!interactive || profileKind(interactive.profile) !== "whip-count") {
    return new Response("Not found", { status: 404 })
  }
  const count = await loadWhipCount(interactive)
  if (!count.success) return new Response("Not found", { status: 404 })

  return new ImageResponse(
    <WhipCountCard
      title={interactive.title}
      data={count.value}
      now={new Date()}
      updatedAt={await whipCountUpdatedAt(interactive)}
    />,
    {
      ...CARD_SIZE,
      fonts: await loadCardFonts(),
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  )
}
