"use client"

import { useEffect, useRef } from "react"

interface ArticleViewBeaconProps {
  articleId: number
  apiPath?: string
}

/**
 * Counts this visit to the article in our own view count: one request to our own API once
 * the page has loaded, with no cookie and nothing about the reader. Ad blockers stop the
 * trackers they know, like Google Analytics, but not a site's own endpoints, so this counts
 * readers GA can't. Renders nothing. The page leaves it out in preview.
 */
export function ArticleViewBeacon({ articleId, apiPath = "/api" }: ArticleViewBeaconProps): null {
  const sent = useRef<number | null>(null)

  useEffect(() => {
    if (sent.current === articleId) return
    sent.current = articleId
    const url = `${apiPath}/articles/${articleId}/view`
    // sendBeacon survives the reader leaving at once, and never holds the page up.
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url)) return
    // A count that doesn't arrive isn't worth troubling the reader about.
    void fetch(url, { method: "POST", keepalive: true, credentials: "omit" }).catch(() => null)
  }, [apiPath, articleId])

  return null
}
