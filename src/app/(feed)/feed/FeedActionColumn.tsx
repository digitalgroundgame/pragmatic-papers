"use client"

import { Button } from "@/components/ui/button"
import { getClientSideURL } from "@/utilities/getURL"
import { Share2 } from "lucide-react"
import React, { useCallback } from "react"
import type { FeedArticle } from "./types"

interface FeedActionColumnProps {
  article: FeedArticle
}

// The right-aligned column of per-article actions that sits above the
// hero title card. Today just Share; in the future this is where
// narration / comments / author-avatar actions will live too.
export function FeedActionColumn({ article }: FeedActionColumnProps): React.ReactNode {
  const handleShare = useCallback(() => {
    const url = `${getClientSideURL()}/articles/${article.slug}`
    const title = article.title
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      navigator.share({ title, url }).catch(() => {
        /* user cancelled or share unavailable */
      })
      return
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(url).catch(() => {
        /* clipboard blocked */
      })
    }
  }, [article.slug, article.title])

  return (
    <div className="flex flex-col items-end gap-3">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleShare}
        className="h-10 w-10 rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 hover:text-white"
        aria-label="Share article"
      >
        <Share2 className="size-5" />
      </Button>
    </div>
  )
}
