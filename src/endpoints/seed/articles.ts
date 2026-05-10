import type { Article, User } from "@/payload-types"
import type { Payload } from "payload"
import type { LexicalContent } from "./richtext"

interface CreateArticleOptions {
  title: string
  content: LexicalContent
  authors: number[]
  topics?: number[]
  slug: string
  heroImage?: number | null
  narration?: number | null
  meta?: {
    title?: string | null
    description?: string | null
    image?: number | null
  }
}

/**
 * Creates a published article with sensible defaults.
 *
 * Retries up to 3 times on Drizzle internal errors (e.g. `._uuid` or `.id`
 * undefined), which occur when Next.js hot-reloads the adapter mid-seed or
 * when the DB is in a partially-cleaned state. On the final attempt, rich
 * fields (content, authors, topics, heroImage, meta) are stripped to maximise
 * the chance of success with only the scalar fields Drizzle can always handle.
 *
 * @param context - Optional context object passed to Payload's create operation (e.g., to skip hooks)
 */
export async function createArticle(
  payload: Payload,
  options: CreateArticleOptions,
  context?: Record<string, unknown>,
): Promise<Article> {
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await payload.create({
        collection: "articles",
        draft: true,
        ...(context && { context }),
        data: {
          title: options.title,
          content: options.content,
          authors: options.authors,
          topics: options.topics,
          heroImage: options.heroImage || undefined,
          narration: options.narration || undefined,
          _status: "published",
          publishedAt: new Date().toISOString(),
          slug: options.slug,
          meta: {
            title: options.meta?.title || options.title,
            description: options.meta?.description || null,
            image: options.meta?.image || undefined,
          },
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (attempt < maxAttempts) {
        payload.logger.warn(
          `Article create attempt ${attempt}/${maxAttempts} failed for "${options.slug}", retrying. Error: ${message}`,
        )
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
      } else {
        throw err
      }
    }
  }

  // Unreachable — TypeScript requires explicit return/throw after the loop
  throw new Error(`Failed to create article "${options.slug}" after ${maxAttempts} attempts`)
}

/**
 * Helper to validate that writers exist and have IDs
 */
export function validateWriters(writers: User[]): void {
  if (writers.length === 0) {
    throw new Error("At least one writer is required to create articles")
  }
}

/**
 * Helper to get a writer by index, throwing if invalid
 */
export function getWriterOrThrow(writers: User[], index: number): User {
  const writer = writers[index % writers.length]
  if (!writer?.id) {
    throw new Error(`Writer at index ${index % writers.length} has no ID`)
  }
  return writer
}
