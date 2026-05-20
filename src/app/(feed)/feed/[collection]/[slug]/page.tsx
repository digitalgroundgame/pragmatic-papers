import { queryArticleBySlug } from "@/utilities/queries"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import React from "react"
import { FeedShell } from "../../FeedShell"
import { getFeedBatch, resolveNextArticle } from "../../getFeedBatch"
import type { FeedArticle } from "../../types"

export const metadata: Metadata = {
  title: "Feed · Pragmatic Papers",
  description: "Swipe through the latest from Pragmatic Papers.",
}

export const dynamic = "force-dynamic"
export const revalidate = 0

interface DeepLinkFeedPageProps {
  params: Promise<{ collection: string; slug: string }>
  searchParams: Promise<{ p?: string }>
}

export default async function DeepLinkFeedPage({
  params,
  searchParams,
}: DeepLinkFeedPageProps): Promise<React.ReactNode> {
  const { collection, slug } = await params
  const { p } = await searchParams

  if (collection !== "articles") return notFound()

  const article = await queryArticleBySlug(slug)
  if (!article) return notFound()

  const target = article as unknown as FeedArticle

  const batch = await getFeedBatch({ cursor: 1 })
  const filtered = batch.items.filter((a) => a.id !== target.id)

  // Prefer the batch's version of the pinned doc (already carries
  // `nextArticle`); otherwise resolve it explicitly so the thanks page
  // can offer a follow-up.
  const fromBatch = batch.items.find((a) => a.id === target.id)
  const pinned: FeedArticle = fromBatch ?? {
    ...target,
    nextArticle: await resolveNextArticle(target),
  }
  const items: FeedArticle[] = [pinned, ...filtered]

  const parsed = p ? Number.parseInt(p, 10) : NaN
  const initialPageIndex = Number.isFinite(parsed) && parsed > 0 ? parsed : 0

  return (
    <FeedShell
      initialItems={items}
      initialNextCursor={batch.nextCursor}
      initialPinnedArticleId={target.id}
      initialPageIndex={initialPageIndex}
    />
  )
}
