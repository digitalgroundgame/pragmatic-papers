import type { Payload } from "payload"

import { revalidatePath, revalidateTag } from "next/cache"

import { purgeEdgeCache } from "./purgeEdgeCache"

type Logger = Payload["logger"]

/** The home page's path: it can list anything a `shared` save changes. */
const HOME = "/"

export interface ReadersRevalidation {
  /** Paths to revalidate in Next's cache and purge from the edge. */
  paths?: readonly (string | null | undefined)[]
  /** `revalidateTag` tags, revalidated with the `max` profile. */
  tags?: readonly string[]
  /**
   * Paths to purge from the edge only: pages that render per request, so Next holds no copy
   * of them to revalidate (and `revalidatePath` on one that reads `draftMode()` throws).
   */
  purgeOnly?: readonly (string | null | undefined)[]
  /**
   * Also purge every page that lists articles, volumes or contributors on the Worker. With
   * `paths`, also revalidate the home page, the one of them that's prerendered rather than
   * rendered per request.
   */
  shared?: boolean
}

/**
 * Revalidate what a save changed for readers, here and on the Worker: each path and tag in
 * Next's cache, then the same paths (and `purgeOnly`) from the edge, telling the Worker to
 * revalidate exactly those paths and tags in its own Next cache. A hook for content readers
 * see calls this once per document it changed, after deciding what changed
 * (`readersChange`), and only when `context.disableRevalidate` is unset.
 */
export function revalidateForReaders(
  logger: Logger,
  reason: string,
  { paths = [], tags = [], purgeOnly = [], shared = false }: ReadersRevalidation,
): void {
  const named = paths.filter((path): path is string => !!path)
  // A save that changed a page readers see (an article, a volume, a contributor) can change
  // what home lists. One that named none (a topic just created, media nothing shows) can't,
  // and may run outside a request, where revalidatePath throws.
  if (shared && named.length && !named.includes(HOME)) named.push(HOME)
  for (const path of named) {
    logger.info(`Revalidating ${path} (${reason})`)
    revalidatePath(path)
  }
  for (const tag of tags) revalidateTag(tag, "max")
  purgeEdgeCache(logger, reason, {
    paths: [...named, ...purgeOnly],
    shared,
    revalidated: { paths: named, tags },
  })
}
