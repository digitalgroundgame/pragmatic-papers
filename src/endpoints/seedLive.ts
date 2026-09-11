import type { Payload } from "payload"
import type { Article, User, Media } from "@/payload-types"
import { createMediaFromURL } from "@/endpoints/seed/media"

interface LiveAuthor {
  name?: string
  slug: string
  affiliation?: string | null
  biography?: unknown
  profileImage?: {
    url?: string
    alt?: string
    caption?: unknown
    sizes?: Record<string, { url?: string }> | null
  } | null
  socials?: unknown[] | null
}

interface LiveTopic {
  name?: string
  slug: string
  description?: string | null
}

interface LiveVolume {
  title?: string
  volumeNumber?: number | null
  publishedAt?: string | null
}

interface LiveArticle {
  title: string
  slug: string
  content?: unknown
  populatedAuthors?: LiveAuthor[] | null
  topics?: LiveTopic[] | null
  heroImage?: {
    url?: string
    alt?: string
    caption?: unknown
    sizes?: Record<string, { url?: string }> | null
  } | null
  meta?: {
    title?: string | null
    description?: string | null
    image?: {
      url?: string
      alt?: string
      caption?: unknown
      sizes?: Record<string, { url?: string }> | null
    } | null
  } | null
  narration?: {
    url?: string
    alt?: string
    caption?: unknown
    sizes?: Record<string, { url?: string }> | null
  } | null
  publishedAt?: string | null
  enableMathRendering?: boolean | null
  populatedVolume?: LiveVolume | null
}

async function getOrCreateMediaId(
  payload: Payload,
  remoteMedia: {
    url?: string
    alt?: string
    caption?: unknown
    sizes?: Record<string, { url?: string }> | null
  },
  mediaCache: Map<string, number>,
): Promise<number | undefined> {
  const originalUrl = remoteMedia.url
  if (!originalUrl) return undefined

  if (mediaCache.has(originalUrl)) {
    return mediaCache.get(originalUrl)
  }

  // Check database first to see if we already have it from a previous seed run
  const basename = originalUrl.split("/").pop() || ""
  if (basename) {
    const existing = await payload.find({
      collection: "media",
      where: {
        filename: {
          contains: basename,
        },
      },
      limit: 1,
    })

    const existingId = existing.docs[0]?.id
    if (existingId !== undefined) {
      mediaCache.set(originalUrl, existingId)
      return existingId
    }
  }

  // Check if the original URL is accessible (status 200)
  let url = originalUrl
  let isAccessible = false
  try {
    const checkRes = await fetch(url, { method: "HEAD" })
    if (checkRes.status === 200) {
      isAccessible = true
    }
  } catch {
    // Ignore error
  }

  // If the original URL is not accessible, check fallback sizes
  if (!isAccessible && remoteMedia.sizes) {
    const preferredSizes = ["large", "xlarge", "og", "medium", "small"]
    let fallbackUrl: string | undefined = undefined

    for (const sizeName of preferredSizes) {
      const sizeUrl = remoteMedia.sizes[sizeName]?.url
      if (sizeUrl) {
        try {
          const checkRes = await fetch(sizeUrl, { method: "HEAD" })
          if (checkRes.status === 200) {
            fallbackUrl = sizeUrl
            break
          }
        } catch {
          // Ignore
        }
      }
    }

    // If none of the preferred sizes worked, try any size that works
    if (!fallbackUrl) {
      for (const sizeName in remoteMedia.sizes) {
        const sizeUrl = remoteMedia.sizes[sizeName]?.url
        if (sizeUrl) {
          try {
            const checkRes = await fetch(sizeUrl, { method: "HEAD" })
            if (checkRes.status === 200) {
              fallbackUrl = sizeUrl
              break
            }
          } catch {
            // Ignore
          }
        }
      }
    }

    if (fallbackUrl) {
      payload.logger.info(
        `Original media URL "${originalUrl}" is not accessible. Using fallback size: "${fallbackUrl}"`,
      )
      url = fallbackUrl
    } else {
      payload.logger.warn(
        `Media URL "${originalUrl}" and its resized versions are not accessible. Skipping.`,
      )
      return undefined
    }
  } else if (!isAccessible) {
    payload.logger.warn(
      `Media URL "${originalUrl}" is not accessible and has no resized fallbacks. Skipping.`,
    )
    return undefined
  }

  // Not found locally or in cache, let's download and create it
  try {
    const altText = remoteMedia.alt || "Uploaded media"
    const mediaDoc = await createMediaFromURL(payload, url, altText, {
      caption: remoteMedia.caption as Media["caption"],
    })
    mediaCache.set(originalUrl, mediaDoc.id)
    return mediaDoc.id
  } catch (err) {
    payload.logger.error({ err }, `Failed to seed media from URL "${url}"`)
    return undefined
  }
}

async function linkArticleToVolume(
  payload: Payload,
  populatedVolume: LiveVolume,
  articleId: number,
): Promise<void> {
  const volumeNumber = populatedVolume.volumeNumber
  if (typeof volumeNumber !== "number") return

  const existingVolume = await payload.find({
    collection: "volumes",
    where: {
      volumeNumber: {
        equals: volumeNumber,
      },
    },
    limit: 1,
  })

  const volume = existingVolume.docs[0]
  if (volume) {
    const currentArticles = volume.articles || []
    // Cast elements to number to ensure types match
    const articleIds = currentArticles.map((a: number | { id: number }) =>
      typeof a === "object" ? a.id : a,
    )
    if (!articleIds.includes(articleId)) {
      await payload.update({
        collection: "volumes",
        id: volume.id,
        data: {
          articles: [...articleIds, articleId],
        },
      })
    }
  } else {
    // Create new volume
    await payload.create({
      collection: "volumes",
      draft: false,
      data: {
        title: populatedVolume.title || `Volume ${volumeNumber}`,
        volumeNumber,
        slug: String(volumeNumber),
        description: `Volume ${volumeNumber} - Imported from Live`,
        articles: [articleId],
        _status: "published",
        publishedAt: populatedVolume.publishedAt || new Date().toISOString(),
      },
    })
  }
}

async function sanitizeLexicalNodes(
  payload: Payload,
  nodes: unknown[],
  mediaCache: Map<string, number>,
): Promise<void> {
  if (!Array.isArray(nodes)) return

  for (const node of nodes) {
    if (!node || typeof node !== "object") continue

    const nodeObj = node as Record<string, unknown>

    // If it's a block node, process its fields
    if (nodeObj.type === "block" && nodeObj.fields && typeof nodeObj.fields === "object") {
      const fields = nodeObj.fields as Record<string, unknown>
      const blockType = fields.blockType

      if (blockType === "mediaBlock") {
        if (fields.media && typeof fields.media === "object") {
          const localId = await getOrCreateMediaId(payload, fields.media, mediaCache)
          fields.media = localId || undefined
        }
      } else if (blockType === "mediaCollage") {
        if (Array.isArray(fields.images)) {
          for (const item of fields.images) {
            if (item && typeof item === "object" && "media" in item) {
              const itemObj = item as Record<string, unknown>
              if (itemObj.media && typeof itemObj.media === "object") {
                const localId = await getOrCreateMediaId(payload, itemObj.media, mediaCache)
                itemObj.media = localId || undefined
              }
            }
          }
        }
      } else if (blockType === "timeline") {
        if (Array.isArray(fields.events)) {
          for (const ev of fields.events) {
            if (ev && typeof ev === "object" && "avatar" in ev) {
              const evObj = ev as Record<string, unknown>
              if (evObj.avatar && typeof evObj.avatar === "object") {
                const localId = await getOrCreateMediaId(payload, evObj.avatar, mediaCache)
                evObj.avatar = localId || undefined
              }
            }
          }
        }
      }
    }

    // Recursively walk children
    if (Array.isArray(nodeObj.children)) {
      await sanitizeLexicalNodes(payload, nodeObj.children, mediaCache)
    }
  }
}

async function sanitizeLexicalContent(
  payload: Payload,
  content: unknown,
  mediaCache: Map<string, number>,
): Promise<unknown> {
  if (content && typeof content === "object" && "root" in content) {
    const contentObj = content as Record<string, unknown>
    if (contentObj.root && typeof contentObj.root === "object" && "children" in contentObj.root) {
      const rootObj = contentObj.root as Record<string, unknown>
      if (Array.isArray(rootObj.children)) {
        await sanitizeLexicalNodes(payload, rootObj.children, mediaCache)
      }
    }
  }
  return content
}

export async function seedLive(
  payload: Payload,
  onProgress?: (message: string, step: number, total: number) => void,
): Promise<void> {
  onProgress?.("Fetching live articles from pragmaticpapers.com...", 1, 12)

  let res: Response
  try {
    res = await fetch("https://pragmaticpapers.com/api/articles", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })
  } catch (err) {
    throw new Error(
      `Failed to fetch articles from pragmaticpapers.com: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch articles: API returned status ${res.status}`)
  }

  let data: { docs: LiveArticle[] }
  try {
    data = await res.json()
  } catch {
    throw new Error("Failed to parse articles API response as JSON")
  }

  if (!data || !Array.isArray(data.docs)) {
    throw new Error("Invalid API response format: 'docs' array is missing")
  }

  const liveArticles = data.docs
  const total = liveArticles.length
  if (total === 0) {
    onProgress?.("No articles found on the live API.", 2, 12)
    return
  }

  onProgress?.(`Found ${total} articles. Starting import...`, 2, 12)

  // Map to cache media URL downloads so we don't fetch/create the same URL multiple times
  const mediaCache = new Map<string, number>()

  for (let i = 0; i < total; i++) {
    const doc = liveArticles[i]
    if (!doc) continue
    const stepNum = i + 3
    const articleTitle = doc.title || `Article ${i + 1}`
    onProgress?.(`Processing article ${i + 1}/${total}: "${articleTitle}"...`, stepNum, total + 2)

    // 1. Check if article already exists by slug
    const existingArticle = await payload.find({
      collection: "articles",
      where: {
        slug: {
          equals: doc.slug,
        },
      },
      limit: 1,
    })

    const existingArtDoc = existingArticle.docs[0]
    if (existingArtDoc) {
      onProgress?.(
        `Article "${articleTitle}" already exists locally. Skipping creation.`,
        stepNum,
        total + 2,
      )

      // Let's still make sure the volume exists and is linked
      if (doc.populatedVolume && typeof doc.populatedVolume === "object") {
        await linkArticleToVolume(payload, doc.populatedVolume, existingArtDoc.id)
      }
      continue
    }

    // 2. Resolve or create authors
    const authorIds: number[] = []
    if (Array.isArray(doc.populatedAuthors)) {
      for (const author of doc.populatedAuthors) {
        if (author && typeof author === "object" && author.slug) {
          const authorSlug = author.slug
          const existingUser = await payload.find({
            collection: "users",
            where: {
              slug: {
                equals: authorSlug,
              },
            },
            limit: 1,
          })

          const existingUserDoc = existingUser.docs[0]
          if (existingUserDoc) {
            authorIds.push(existingUserDoc.id)
          } else {
            // Create user
            try {
              // Get profile image if present
              let localProfileImageId: number | undefined = undefined
              if (
                author.profileImage &&
                typeof author.profileImage === "object" &&
                author.profileImage.url
              ) {
                localProfileImageId = await getOrCreateMediaId(
                  payload,
                  author.profileImage,
                  mediaCache,
                )
              }

              const newUser = await payload.create({
                collection: "users",
                data: {
                  email: `${authorSlug}@example.com`,
                  password: "password123",
                  name: author.name || authorSlug,
                  role: "writer",
                  slug: authorSlug,
                  affiliation: author.affiliation || undefined,
                  biography: author.biography as User["biography"],
                  profileImage: localProfileImageId,
                  socials: author.socials as User["socials"],
                },
              })
              authorIds.push(newUser.id)
            } catch (err) {
              payload.logger.error({ err }, `Failed to create author "${authorSlug}"`)
            }
          }
        }
      }
    }

    // Fallback: If no authors could be resolved, use a default writer or the first admin
    if (authorIds.length === 0) {
      const defaultUsers = await payload.find({
        collection: "users",
        where: {
          role: {
            equals: "writer",
          },
        },
        limit: 1,
      })
      const defaultUser = defaultUsers.docs[0]
      if (defaultUser) {
        authorIds.push(defaultUser.id)
      } else {
        const admins = await payload.find({
          collection: "users",
          where: {
            role: {
              equals: "admin",
            },
          },
          limit: 1,
        })
        const adminUser = admins.docs[0]
        if (adminUser) {
          authorIds.push(adminUser.id)
        }
      }
    }

    // 3. Resolve or create topics
    const topicIds: number[] = []
    if (Array.isArray(doc.topics)) {
      for (const topic of doc.topics) {
        if (topic && typeof topic === "object" && topic.slug) {
          const topicSlug = topic.slug
          const existingTopic = await payload.find({
            collection: "topics",
            where: {
              slug: {
                equals: topicSlug,
              },
            },
            limit: 1,
          })

          const existingTopicDoc = existingTopic.docs[0]
          if (existingTopicDoc) {
            topicIds.push(existingTopicDoc.id)
          } else {
            try {
              const newTopic = await payload.create({
                collection: "topics",
                data: {
                  name: topic.name || topicSlug,
                  description: topic.description || undefined,
                  slug: topicSlug,
                },
              })
              topicIds.push(newTopic.id)
            } catch (err) {
              payload.logger.error({ err }, `Failed to create topic "${topicSlug}"`)
            }
          }
        }
      }
    }

    // 4. Download and resolve Hero Image
    let localHeroImageId: number | undefined = undefined
    if (doc.heroImage && typeof doc.heroImage === "object" && doc.heroImage.url) {
      localHeroImageId = await getOrCreateMediaId(payload, doc.heroImage, mediaCache)
    }

    // 5. Download and resolve Meta Image
    let localMetaImageId: number | undefined = undefined
    if (doc.meta?.image && typeof doc.meta.image === "object" && doc.meta.image.url) {
      localMetaImageId = await getOrCreateMediaId(payload, doc.meta.image, mediaCache)
    }

    // 6. Download and resolve Narration Audio
    let localNarrationId: number | undefined = undefined
    if (doc.narration && typeof doc.narration === "object" && doc.narration.url) {
      localNarrationId = await getOrCreateMediaId(payload, doc.narration, mediaCache)
    }

    // 6.5 Sanitize Lexical Content to resolve populated media/other relationship fields to local IDs
    const sanitizedContent = await sanitizeLexicalContent(payload, doc.content, mediaCache)

    // 7. Create Article
    let createdArticleId: number
    try {
      const createdArticle = await payload.create({
        collection: "articles",
        context: { skipPopulateVolume: true },
        data: {
          title: doc.title,
          slug: doc.slug,
          content: (sanitizedContent || {
            root: { type: "root", format: "", indent: 0, version: 1, children: [] },
          }) as Article["content"],
          authors: authorIds,
          topics: topicIds,
          heroImage: localHeroImageId,
          narration: localNarrationId,
          publishedAt: doc.publishedAt || new Date().toISOString(),
          _status: "published",
          enableMathRendering: doc.enableMathRendering || false,
          meta: {
            title: doc.meta?.title || doc.title,
            description: doc.meta?.description || null,
            image: localMetaImageId || undefined,
          },
        },
      })
      createdArticleId = createdArticle.id
      onProgress?.(`Imported article: "${articleTitle}"`, stepNum, total + 2)
    } catch (err) {
      payload.logger.error({ err }, `Failed to create article "${doc.slug}"`)
      continue
    }

    // 8. Associate with Volume if volume exists in live data
    if (doc.populatedVolume && typeof doc.populatedVolume === "object") {
      try {
        await linkArticleToVolume(payload, doc.populatedVolume, createdArticleId)
      } catch (err) {
        payload.logger.error({ err }, `Failed to link article "${doc.slug}" to volume`)
      }
    }
  }

  onProgress?.("Import finished successfully!", total + 2, total + 2)
}
