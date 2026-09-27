import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"

import { createTableOfContentsArticle } from "./features/table-of-contents"

/**
 * Feature articles that can be pushed onto a live environment, such as a PR
 * preview, with `pnpm showcase`. Unlike `seed()`, pushing only adds: an entry
 * whose slug already exists is skipped, and nothing is deleted.
 *
 * To showcase a feature, add its seed here with the slug it creates.
 */
export interface ShowcaseEntry {
  slug: string
  create: (
    payload: Payload,
    writers: User[],
    media: Media[],
    context?: Record<string, unknown>,
  ) => Promise<number>
}

export const showcaseEntries: ShowcaseEntry[] = [
  {
    slug: "finding-your-way-table-of-contents",
    create: (payload, writers, media, context) =>
      createTableOfContentsArticle(payload, writers, media, [], context),
  },
]
