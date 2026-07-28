"use client"

import { useMemo } from "react"
import { chunkArticle } from "../chunker"
import type { ArticlePageItem, FeedArticle } from "../types"

export function useArticlePages(article: FeedArticle): ArticlePageItem[] {
  return useMemo(() => chunkArticle(article), [article])
}
