import type { Topic, User } from "@/payload-types"
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
          role: {
            in: ["writer", "editor", "chief-editor", "narrator"],
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
    depth: 2,
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
  })
  return docs[0] || null
})

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
  })

  return docs[0] || null
})
