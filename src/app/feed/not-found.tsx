import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { LinkButton } from "@/components/ui/link-button"
import { CircleAlert } from "lucide-react"
import React from "react"

// The feed has its own root layout, so the site's `(frontend)/not-found.tsx`
// doesn't reach it: without this, a 404 here (the feed switched off, or a deep
// link to an unknown article) is Next's bare default page, with no way back.
export default function FeedNotFound(): React.ReactElement {
  return (
    <div className="bg-background flex h-dvh w-full items-center justify-center px-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <CircleAlert className="text-muted-foreground size-5" />
          </EmptyMedia>
          <EmptyTitle className="grid gap-1">
            <h1 className="text-brand-text">404</h1>
            <span className="text-xl">Not in the feed</span>
          </EmptyTitle>
          <EmptyDescription>
            This link doesn&apos;t lead anywhere in the feed. Everything we publish is still on the
            site.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center gap-2">
          <LinkButton href="/">Go home</LinkButton>
        </EmptyContent>
      </Empty>
    </div>
  )
}
