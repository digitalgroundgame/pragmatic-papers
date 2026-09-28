import "server-only"

import React from "react"
import { ArticleBlockPage, ArticleContentPage } from "./ArticlePage"
import { chunkArticle } from "./chunker"
import { FEED_TOP_INSET } from "./constants"
import { getPageDurationMs } from "./pageDuration"
import type { FeedArticle, RenderedFeedArticle } from "./types"

/**
 * Chunks an article into feed pages and renders each one here, on the server:
 * RichText and the blocks it renders are server-only, so the client pager
 * receives finished elements plus the per-page timing it needs for auto-play.
 */
export function renderFeedArticle(article: FeedArticle): RenderedFeedArticle {
  const pages = chunkArticle(article)
  const { content: _content, footnotes: _footnotes, ...summary } = article

  return {
    article: summary,
    pages: pages.map((page) => ({ kind: page.kind, durationMs: getPageDurationMs(page) })),
    bodies: pages.map((page, i) => {
      const isLast = i === pages.length - 1
      if (page.kind === "content") {
        return (
          <ArticleContentPage
            key={i}
            article={article}
            page={page}
            topInset={FEED_TOP_INSET}
            isLast={isLast}
          />
        )
      }
      if (page.kind === "block") {
        return (
          <ArticleBlockPage
            key={i}
            article={article}
            page={page}
            topInset={FEED_TOP_INSET}
            isLast={isLast}
          />
        )
      }
      return null
    }),
  }
}
