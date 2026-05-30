import { draftMode, headers } from "next/headers"
import React from "react"

import { getAuth } from "@/utilities/getAuth"
import {
  queryArticleBySlug,
  queryPageBySlug,
  queryTopicBySlug,
  queryUserBySlug,
  queryVolumeBySlug,
} from "@/utilities/queries"
import { AdminBarClient } from "./client"

interface RouteConfig {
  plural: string
  singular: string
  // Payload collection slug — differs from the route key when the frontend
  // URL uses a different name (e.g. /authors → "users" collection).
  collectionSlug: string
}

const routes = new Map<string, RouteConfig>([
  ["pages", { collectionSlug: "pages", plural: "Pages", singular: "Page" }],
  ["volumes", { collectionSlug: "volumes", plural: "Volumes", singular: "Volume" }],
  ["articles", { collectionSlug: "articles", plural: "Articles", singular: "Article" }],
  ["authors", { collectionSlug: "users", plural: "Authors", singular: "Author" }],
  ["topics", { collectionSlug: "topics", plural: "Topics", singular: "Topic" }],
])

const collectionRouteKeys = new Set(["articles", "volumes", "authors", "topics"])

function parsePath(pathname: string): { routeKey: string; docSlug: string | undefined } {
  const [, first = "", second] = pathname.split("/")
  if (collectionRouteKeys.has(first)) {
    return { routeKey: first, docSlug: second || undefined }
  }
  return { routeKey: "pages", docSlug: first || "home" }
}

async function queryDocId(routeKey: string, docSlug: string): Promise<number | undefined> {
  const queries: Record<string, (slug: string) => Promise<{ id: number } | null>> = {
    articles: queryArticleBySlug,
    volumes: queryVolumeBySlug,
    authors: queryUserBySlug,
    topics: queryTopicBySlug,
    pages: queryPageBySlug,
  }
  const doc = await queries[routeKey]?.(docSlug)
  return doc?.id ?? undefined
}

export async function AdminBar(): Promise<React.ReactNode> {
  const { isEnabled } = await draftMode()
  const { user } = await getAuth()
  if (!user) return null

  const headersList = await headers()
  const pathname = headersList.get("x-pathname") ?? "/"
  const { routeKey, docSlug } = parsePath(pathname)

  const routeConfig = routes.get(routeKey)
  const collectionSlug = routeConfig?.collectionSlug ?? routeKey
  const collectionLabels = routeConfig
    ? { plural: routeConfig.plural, singular: routeConfig.singular }
    : undefined

  const docId = docSlug ? await queryDocId(routeKey, docSlug) : undefined

  return (
    <div className="h-8 w-full bg-black text-white">
      <AdminBarClient
        preview={isEnabled}
        collectionSlug={collectionSlug}
        collectionLabels={collectionLabels}
        id={docId ? String(docId) : undefined}
      />
    </div>
  )
}
