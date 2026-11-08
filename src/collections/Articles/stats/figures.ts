import type { PageFigures } from "@/integrations/google/analytics"

/** How long an article's GA figures are kept before the tab asks GA again. */
export const GA_CACHE_MS = 60 * 60 * 1000

/** How soon after a fetch Refresh may ask GA again for the same article. */
export const REFRESH_COOLDOWN_MS = 60 * 1000

export interface CachedFigures {
  figures: PageFigures
  /** When GA answered (epoch ms). */
  fetchedAt: number
}

export interface FiguresResult extends CachedFigures {
  /** True when Refresh was asked for within the cooldown, so the cached figures came back. */
  throttled: boolean
}

export interface FiguresCacheOptions {
  ttlMs?: number
  cooldownMs?: number
  now?: () => number
}

export interface FiguresCache {
  /**
   * The cached figures for `key`, or fresh ones when there are none or they're older than
   * the TTL. With `refresh`, fresh ones unless the cached ones are younger than the cooldown.
   */
  get(
    key: string,
    load: () => Promise<PageFigures>,
    options?: { refresh?: boolean },
  ): Promise<FiguresResult>
  clear(): void
}

/**
 * GA figures per article, kept in this process for an hour. Nothing is written to the
 * database: GA stays the source, and a restart only costs one query per article opened. The
 * admin runs in one process, so there's no cache to share between instances.
 *
 * A failed fetch isn't kept, so the next open tries again.
 */
export function createFiguresCache({
  ttlMs = GA_CACHE_MS,
  cooldownMs = REFRESH_COOLDOWN_MS,
  now = Date.now,
}: FiguresCacheOptions = {}): FiguresCache {
  const entries = new Map<string, CachedFigures>()
  const pending = new Map<string, Promise<CachedFigures>>()

  const fetchFresh = (key: string, load: () => Promise<PageFigures>): Promise<CachedFigures> => {
    const inFlight = pending.get(key)
    if (inFlight) return inFlight
    const request = load()
      .then((figures) => {
        const entry = { figures, fetchedAt: now() }
        entries.set(key, entry)
        return entry
      })
      .finally(() => pending.delete(key))
    pending.set(key, request)
    return request
  }

  return {
    async get(
      key: string,
      load: () => Promise<PageFigures>,
      { refresh = false }: { refresh?: boolean } = {},
    ): Promise<FiguresResult> {
      const cached = entries.get(key)
      const age = cached ? now() - cached.fetchedAt : Infinity
      if (cached && refresh && age < cooldownMs) return { ...cached, throttled: true }
      if (cached && !refresh && age < ttlMs) return { ...cached, throttled: false }
      return { ...(await fetchFresh(key, load)), throttled: false }
    },
    clear(): void {
      entries.clear()
      pending.clear()
    },
  }
}

/** The one cache the Stats endpoint uses. */
export const articleFiguresCache = createFiguresCache()
