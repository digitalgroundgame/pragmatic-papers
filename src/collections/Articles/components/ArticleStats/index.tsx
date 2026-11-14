"use client"

import { useConfig, useDocumentInfo } from "@payloadcms/ui"
import React, { useCallback } from "react"

import type { ArticleStats as Stats } from "@/collections/Articles/stats/endpoint"

import { ArticleStatsView } from "./ArticleStatsView"

/** The article's Stats tab, reading `/api/articles/:id/stats`. */
export function ArticleStats(): React.ReactNode {
  const { id } = useDocumentInfo()
  const {
    config: {
      routes: { api },
    },
  } = useConfig()

  const load = useCallback(
    async (refresh: boolean): Promise<Stats> => {
      const url = `${api}/articles/${id}/stats${refresh ? "/refresh" : ""}`
      const response = await fetch(url, {
        method: refresh ? "POST" : "GET",
        credentials: "include",
      })
      if (!response.ok) throw new Error(`Stats request failed: ${response.status}`)
      return (await response.json()) as Stats
    },
    [api, id],
  )

  if (id == null) return null
  return <ArticleStatsView load={load} />
}
