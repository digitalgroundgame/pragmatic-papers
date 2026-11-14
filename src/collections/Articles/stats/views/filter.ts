/**
 * User agents that say they're a crawler, a preview fetcher or a headless browser. Most bots
 * never run the page's JavaScript, so they never send a view; this catches the ones that do
 * and are honest about it.
 */
const BOT_AGENT =
  /bot|crawl|spider|slurp|preview|fetch|scrape|headless|lighthouse|pagespeed|phantom|python|curl|wget|httpclient|java\/|go-http/i

export const isLikelyBot = (userAgent: string | null | undefined): boolean =>
  !userAgent || BOT_AGENT.test(userAgent)

/** The reader's address, as Cloudflare or the proxy in front of us passes it on. */
export const clientAddress = (headers: Headers): string | null =>
  headers.get("cf-connecting-ip") ??
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  headers.get("x-real-ip") ??
  null

export interface ViewLimiterOptions {
  /** Views one address may add to one article per window. */
  limit?: number
  windowMs?: number
  /** Past this many tracked pairs, the oldest windows are dropped. */
  maxEntries?: number
  now?: () => number
}

export interface ViewLimiter {
  /** Whether this address may add a view to this article now; counts it if so. */
  allow(address: string, articleId: number): boolean
  clear(): void
}

/**
 * Caps the views one address adds to one article, so a script reloading a page can't run the
 * count up. Kept in this process's memory only: addresses are never written anywhere, and a
 * restart forgets them. The cap is generous because many readers can share one address (an
 * office, a phone network).
 */
export function createViewLimiter({
  limit = 20,
  windowMs = 60 * 60 * 1000,
  maxEntries = 50_000,
  now = Date.now,
}: ViewLimiterOptions = {}): ViewLimiter {
  const windows = new Map<string, { start: number; count: number }>()

  return {
    allow(address, articleId) {
      const key = `${address}|${articleId}`
      const time = now()
      const current = windows.get(key)
      if (current && time - current.start < windowMs) {
        if (current.count >= limit) return false
        current.count += 1
        return true
      }
      windows.delete(key)
      if (windows.size >= maxEntries) {
        // Maps keep insertion order, so the first keys are the oldest windows.
        for (const old of windows.keys()) {
          windows.delete(old)
          if (windows.size < maxEntries * 0.9) break
        }
      }
      windows.set(key, { start: time, count: 1 })
      return true
    },
    clear() {
      windows.clear()
    },
  }
}
