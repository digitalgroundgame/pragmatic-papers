"use client"

import { ForwardIcon, MessageSquareIcon } from "lucide-react"
import React, { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

import { trackCommentShare } from "./analytics"

/** The permalink to one comment on the page the reader is on. */
export const commentHref = (id: number | string): string =>
  `${window.location.origin}${window.location.pathname}#comment-${String(id)}`

/** Copies a comment's link, and says so for a moment. */
const ShareButton: React.FC<{ id: number | string; itemId?: string }> = ({ id, itemId }) => {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const share = async () => {
    try {
      await navigator.clipboard.writeText(commentHref(id))
      setCopied(true)
      trackCommentShare(itemId)
    } catch {
      // No clipboard (an insecure origin, or permission refused): put the link in the address
      // bar instead, where the reader can copy it.
      window.history.replaceState(null, "", `#comment-${String(id)}`)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="text-muted-foreground"
        onClick={() => void share()}
      >
        <ForwardIcon aria-hidden="true" data-icon="inline-start" />
        Share
      </Button>
      {copied ? (
        <span role="status" className="text-muted-foreground text-xs">
          Link copied
        </span>
      ) : null}
    </>
  )
}

/** What a reader can do with a comment: reply to it, and share it. */
export const CommentActions: React.FC<{
  id: number | string
  /** The article's slug, for analytics. */
  itemId?: string
  /** Shown where Reply would be when replies stop at this depth. */
  replyLimit?: string | null
  onReply?: () => void
}> = ({ id, itemId, replyLimit, onReply }) => (
  <div className="-ml-2 flex flex-wrap items-center gap-1">
    {onReply ? (
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="text-muted-foreground"
        onClick={onReply}
      >
        <MessageSquareIcon aria-hidden="true" data-icon="inline-start" />
        Reply
      </Button>
    ) : replyLimit ? (
      <span className="text-muted-foreground px-2 text-xs">{replyLimit}</span>
    ) : null}
    <ShareButton id={id} itemId={itemId} />
  </div>
)
