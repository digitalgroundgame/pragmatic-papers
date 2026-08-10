import { PUBLIC_PROFILE_ROLES } from "@/access/roles"
import type { Topic, User, Volume } from "@/payload-types"
import { draftMode } from "next/headers"
import { cache } from "react"
import { getPayloadConfig } from "./getPayloadConfig"

export const queryUserBySlug = cache(async (slug: string): Promise<User | null> => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayloadConfig()
  const { docs } = await payload.find({
    collection: "users",
    draft,
    limit: 1,
    pagination: false,
    where: {
      and: [
        {
          roles: {
            in: PUBLIC_PROFILE_ROLES,
          },
        },
        {
          slug: {
            equals: slug,
          },
        },
      ],
    },
    depth: 1,
  })

  return docs[0] || null
})

export const queryTopicBySlug = cache(async (slug: string): Promise<Topic | null> => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayloadConfig()
  const { docs } = await payload.find({
    collection: "topics",
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
    depth: 0,
  })

  return docs[0] || null
})

export const queryVolumeBySlug = cache(async (slug: string) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayloadConfig()
  const { docs } = await payload.find({
    collection: "volumes",
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
    // volume -> articles -> authors -> profileImage: author images on a volume
    // page sit one level deeper than on an article page.
    depth: 3,
  })

  return docs[0] || null
})

export const queryArticleBySlug = cache(async (slug: string) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayloadConfig()
  const { docs } = await payload.find({
    collection: "articles",
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: { slug: { equals: slug } },
    // Load-bearing since relationships resolve natively: article -> authors ->
    // profileImage and article -> narration -> narrator both need depth 2.
    depth: 2,
  })
  return docs[0] || null
})

// Keyed by a normalized string rather than the caller's array, so two
// components asking for the same article IDs in the same request share one
// query instead of memoizing on array identity.
const queryVolumesForArticleKey = cache(async (key: string): Promise<Volume[]> => {
  const articleIds = key.split(",").map(Number)

  const { isEnabled: draft } = await draftMode()
  const payload = await getPayloadConfig()
  const { docs } = await payload.find({
    collection: "volumes",
    draft,
    limit: 1000,
    overrideAccess: draft,
    pagination: false,
    where: {
      articles: {
        in: articleIds,
      },
    },
    depth: 0,
  })

  return docs
})

/** Resolves the volumes containing any of `articleIds` in a single query. */
export const queryVolumesForArticles = async (articleIds: number[]): Promise<Volume[]> => {
  if (!articleIds.length) return []

  const key = Array.from(new Set(articleIds))
    .sort((a, b) => a - b)
    .join(",")

  return queryVolumesForArticleKey(key)
}

export const queryPageBySlug = cache(async (slug: string) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayloadConfig()
  const { docs } = await payload.find({
    collection: "pages",
    draft,
    limit: 1,
    pagination: false,
    overrideAccess: draft,
    where: {
      slug: {
        equals: slug,
      },
    },
    // Load-bearing since relationships resolve natively: layout blocks ->
    // articles -> authors needs depth 2.
    depth: 2,
  })

  return docs[0] || null
})
