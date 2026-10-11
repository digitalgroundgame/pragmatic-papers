import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { LinkButton } from "@/components/ui/link-button"
import { isExperimentEnabled } from "@/globals/SiteSettings/isExperimentEnabled"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import React from "react"
import { FeedShell } from "./FeedShell"
import { getFeedBatch } from "./getFeedBatch"
import { renderFeedArticle } from "./renderFeedArticle"

// The feed renders whole article bodies, so a crawler would index it as a copy
// of the articles. Links out of it are still followed.
export const metadata: Metadata = {
  title: "Feed · Pragmatic Papers",
  description: "Swipe through the latest from Pragmatic Papers.",
  robots: { index: false, follow: true },
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function FeedPage(): Promise<React.ReactNode> {
  // The feed is an experiment (Settings): off in this environment, it 404s.
  if (!(await isExperimentEnabled("feed"))) notFound()

  const batch = await getFeedBatch({ cursor: 1 })

  if (batch.items.length === 0) {
    return (
      <div className="bg-background flex h-dvh w-full items-center justify-center px-6">
        <Empty className="border-border bg-muted/30 text-foreground">
          <EmptyHeader>
            <EmptyTitle>Nothing to read yet</EmptyTitle>
            <EmptyDescription>
              No published articles are available right now. Check back soon.
            </EmptyDescription>
          </EmptyHeader>
          <LinkButton variant="outline" href="/">
            Back to home
          </LinkButton>
        </Empty>
      </div>
    )
  }

  return (
    <FeedShell
      initialItems={batch.items.map(renderFeedArticle)}
      initialNextCursor={batch.nextCursor}
    />
  )
}
