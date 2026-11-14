import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { ImageResponse } from "next/og"
import React from "react"

import { queryInteractiveBySlug } from "@/interactives/load"
import { profileKind } from "@/interactives/profiles"
import { CARD_SIZE, WhipCountCard } from "@/interactives/whip-count/card"
import { loadWhipCount, whipCountUpdatedAt } from "@/interactives/whip-count/load"

interface Args {
  params: Promise<{ slug: string }>
}

const GEIST = "node_modules/geist/dist/fonts/geist-sans"
const LIBERTINUS = "node_modules/@expo-google-fonts/libertinus-serif/700Bold"

/**
 * The site's fonts in the weights the card uses, read from their packages
 * (`outputFileTracingIncludes` copies them into the build): Geist, and Libertinus Serif Bold
 * for the eyebrow. Without them, as in the Worker, which has no files to read, `next/og` draws
 * everything in its own Geist Regular.
 */
async function siteFonts(): Promise<
  { name: string; data: ArrayBuffer; weight: 400 | 600 | 700 }[] | undefined
> {
  const read = async (file: string): Promise<ArrayBuffer> => {
    const bytes = await readFile(join(process.cwd(), file))
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  }
  try {
    return [
      { name: "Geist", data: await read(`${GEIST}/Geist-Regular.ttf`), weight: 400 },
      { name: "Geist", data: await read(`${GEIST}/Geist-SemiBold.ttf`), weight: 600 },
      { name: "Geist", data: await read(`${GEIST}/Geist-Bold.ttf`), weight: 700 },
      {
        name: "Libertinus Serif",
        data: await read(`${LIBERTINUS}/LibertinusSerif_700Bold.ttf`),
        weight: 700,
      },
    ]
  } catch {
    return undefined
  }
}

/**
 * A whip count's link preview, 1200×630: the leading candidates head to head, one tick a voter,
 * the countdown and the site's mark (`WhipCountCard`). The page's metadata points at it, with
 * a query that changes with the count and the day, so the edge may keep each one a day.
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
      fonts: await siteFonts(),
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  )
}
