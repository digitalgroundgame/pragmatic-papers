import type { Payload } from "payload"

import { docPath } from "@/utilities/routes"
import { absoluteURL } from "@/utilities/getURL"

type Logger = Pick<Payload["logger"], "info" | "warn">

/** The section indexes, feeds and sitemap index readers and crawlers ask for most. */
export const WARM_PATHS = [
  "/",
  "/articles",
  "/volumes",
  "/contributors",
  "/topics",
  "/articles/feed.xml",
  "/volumes/feed.xml",
  "/sitemap_index.xml",
]

/** At most this many pages, so a large volume can't turn a deploy into a crawl. */
export const MAX_WARM_PAGES = 40
/** Pages requested at once: enough to finish quickly, few enough not to load the origin. */
const CONCURRENCY = 4
/** A page that takes longer than this is left for its first reader. */
const TIMEOUT_MS = 20_000
/** Cloudflare's purge reaches every data center within seconds; warming sooner is undone. */
export const PURGE_SETTLE_MS = 5_000

/** The newest published volume's page and its articles', after `WARM_PATHS`. */
async function newestVolumePaths(payload: Pick<Payload, "find">): Promise<string[]> {
  const { docs } = await payload.find({
    collection: "volumes",
    where: { _status: { equals: "published" } },
    sort: "-publishedAt",
    limit: 1,
    depth: 1,
    overrideAccess: false,
    select: { slug: true, articles: true },
  })
  const volume = docs[0]
  if (!volume?.slug) return []
  const articles = (volume.articles ?? []).flatMap((article) =>
    typeof article === "object" && article?.slug && article._status === "published"
      ? [docPath("articles", article.slug)]
      : [],
  )
  return [docPath("volumes", volume.slug), ...articles]
}

async function warm(url: string, fetchImpl: typeof fetch): Promise<boolean> {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    // Read the body: the origin renders while it streams, and the edge stores it at the end.
    await response.arrayBuffer()
    return response.ok
  } catch {
    return false
  }
}

/**
 * Request the most-read pages through the site's public URL, so the origin renders them and
 * Cloudflare's edge stores them before readers arrive. A deploy empties both caches
 * (`/next/revalidate-all`, then the edge purge), and the first reader of each page would
 * otherwise wait for its render, along with everyone who arrived with them.
 *
 * Never throws: a page that fails is logged and left for its first reader.
 */
export async function warmPages(
  payload: Pick<Payload, "find"> & { logger: Logger },
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {},
): Promise<void> {
  let volumePaths: string[] = []
  try {
    volumePaths = await newestVolumePaths(payload)
  } catch (err) {
    payload.logger.warn(
      `Couldn't look up the newest volume to warm: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  const urls = [...new Set([...WARM_PATHS, ...volumePaths])]
    .slice(0, MAX_WARM_PAGES)
    .map((path) => absoluteURL(path))

  const failed: string[] = []
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < urls.length) {
      const url = urls[next++]!
      if (!(await warm(url, fetchImpl))) failed.push(url)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker))

  if (failed.length) {
    payload.logger.warn(
      `Warmed ${urls.length - failed.length} of ${urls.length} pages after the deploy; failed: ${failed.join(", ")}`,
    )
  } else {
    payload.logger.info(`Warmed ${urls.length} pages after the deploy`)
  }
}
