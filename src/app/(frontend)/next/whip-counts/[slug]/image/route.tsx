import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { ImageResponse } from "next/og"
import React from "react"

import { queryInteractiveBySlug } from "@/interactives/load"
import { profileKind } from "@/interactives/profiles"
import { CARD_SIZE, WhipCountCard } from "@/interactives/whip-count/card"
import { loadWhipCount } from "@/interactives/whip-count/load"

interface Args {
  params: Promise<{ slug: string }>
}

const FONTS = join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans")

/**
 * Geist in the weights the card uses, read from the package (`outputFileTracingIncludes`
 * copies them into the build). Without them, as in the Worker, which has no files to read,
 * `next/og` draws everything in its own Geist Regular.
 */
async function geist(): Promise<
  { name: string; data: ArrayBuffer; weight: 400 | 600 | 700 }[] | undefined
> {
  const read = async (file: string): Promise<ArrayBuffer> => {
    const bytes = await readFile(join(FONTS, file))
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  }
  try {
    return [
      { name: "Geist", data: await read("Geist-Regular.ttf"), weight: 400 },
      { name: "Geist", data: await read("Geist-SemiBold.ttf"), weight: 600 },
      { name: "Geist", data: await read("Geist-Bold.ttf"), weight: 700 },
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
    <WhipCountCard title={interactive.title} data={count.value} now={new Date()} />,
    {
      ...CARD_SIZE,
      fonts: await geist(),
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  )
}
