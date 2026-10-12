/**
 * The Worker's edge cache: Cloudflare's Workers Cache, which answers a request from the
 * edge before the Worker runs. It's switched on for one entrypoint, `CachedSite`
 * (`worker.mjs`, `exports` in wrangler.jsonc), and the default entrypoint is a gateway in
 * front of it that decides what may go through.
 *
 * Workers Cache keys a response by path and query only, never by cookie, so anything
 * personal has to skip it: Payload's login, Next's draft mode, anything with an
 * Authorization header. So do Server Action requests (`Next-Action`), which Next answers
 * differently at the same URL, and OpenNext's own revalidation requests
 * (`x-prerender-revalidate`, through `WORKER_SELF_REFERENCE`), which must re-render, and
 * navigations (RSC requests): Next varies those on the router's state and checks `_rsc`
 * against it, and OpenNext already answers them from its R2 cache by route. What's left
 * is full page loads and resized images, the same set the zone cache holds for Coolify,
 * kept for as long as `CDN-Cache-Control` says.
 *
 * The cache belongs to the Worker version, so a deploy starts it empty. Every page it keeps
 * is tagged with its path (`Cache-Tag`), so a save's `/next/revalidate-all` can purge just
 * the paths that save revalidated (`?path=`), or everything when it names none.
 */
import { isOriginPath, type WorkerEnv, type WorkerHandler } from "./origin"

/** The cached entrypoint, as `ctx.exports` offers it to the gateway. */
export interface EdgeCachedSite {
  fetch(request: Request): Promise<Response>
}

/** What the gateway reads from its execution context. */
export interface GatewayContext {
  exports?: { CachedSite?: EdgeCachedSite }
}

/** What `ctx.cache.purge()` resolves to. A refusal (a rate limit) resolves, it doesn't throw. */
export interface EdgeCachePurgeResult {
  success: boolean
  errors?: { code: number; message: string }[]
}

/** `ctx.cache` in the cached entrypoint. */
export interface EdgeCache {
  purge?: (options: { purgeEverything: true } | { tags: string[] }) => Promise<EdgeCachePurgeResult>
}

/** Cookies that make a page personal: Payload's login and Next's draft mode. */
const PERSONAL_COOKIES = ["payload-token", "__prerender_bypass"]

const hasCookie = (cookies: string, name: string): boolean =>
  cookies.split(";").some((cookie) => cookie.trim().startsWith(`${name}=`))

export const REVALIDATE_ALL_PATH = "/next/revalidate-all"

const isRevalidateAll = (request: Request): boolean =>
  request.method === "POST" && new URL(request.url).pathname === REVALIDATE_ALL_PATH

/** Tags sent in one purge call. */
const TAGS_PER_PURGE = 30

const normalize = (pathname: string): string => pathname.replace(/\/+$/, "") || "/"

/** The cache tag on every page at this path, whatever its query string. */
export function pathTag(pathname: string): string {
  return `path:${normalize(pathname)}`
}

/**
 * The tag on every page under a document's path (`/interactives/a/regions/x` is under
 * `/interactives/a`), so purging the document's path takes the routes beneath it too.
 */
function withinTag(pathname: string): string {
  return `within:${normalize(pathname)}`
}

/** The document path a deeper path sits under, or null for one two segments deep or less. */
function documentPath(pathname: string): string | null {
  const segments = normalize(pathname).split("/").slice(1)
  return segments.length > 2 ? `/${segments.slice(0, 2).join("/")}` : null
}

/**
 * The tag on every page that lists or shows articles, volumes and contributors: the home
 * page and other Pages, the indexes, topic and contributor pages, feeds, sitemaps and search.
 * They render per request on Coolify, so no save's hook names them, and a save to an article,
 * volume or contributor purges them all (`?shared`).
 */
export const SHARED_TAG = "shared"

/** Files under /articles and /volumes that list them, rather than being one of them. */
const SECTION_LISTINGS = new Set(["feed.xml", "sitemap.xml", "news-sitemap.xml", "substack.xml"])

/** Whether a page shows more than one document: anything but an article or volume's own. */
function isShared(pathname: string): boolean {
  const [section = "", slug] = pathname.split("/").slice(1)
  if (section === "docs" || section === "interactives" || section === "_next") return false
  if ((section === "articles" || section === "volumes") && slug) {
    return SECTION_LISTINGS.has(slug)
  }
  return true
}

/** The tags the cache keeps a page under. */
export function edgeCacheTags(pathname: string): string[] {
  const tags = [pathTag(pathname)]
  const document = documentPath(pathname)
  if (document) tags.push(withinTag(document))
  if (isShared(pathname)) tags.push(SHARED_TAG)
  return tags
}

/**
 * The tags a `/next/revalidate-all` asks to purge: each `?path=`, and the shared pages with
 * `?shared`. Null, for everything, when it names neither.
 */
function tagsToPurge(request: Request): string[] | null {
  const { searchParams } = new URL(request.url)
  const tags = searchParams
    .getAll("path")
    .filter((path) => path.startsWith("/"))
    .flatMap((path) => [pathTag(path), withinTag(path)])
  if (searchParams.has("shared")) tags.push(SHARED_TAG)
  return tags.length ? [...new Set(tags)] : null
}

async function purge(
  cache: EdgeCache | undefined,
  tags: string[] | null,
  log: Pick<Console, "warn">,
): Promise<void> {
  if (typeof cache?.purge !== "function") {
    log.warn("The Worker's edge cache can't be purged here (no ctx.cache.purge)")
    return
  }
  const calls: ({ purgeEverything: true } | { tags: string[] })[] = []
  if (!tags) calls.push({ purgeEverything: true })
  else
    for (let i = 0; i < tags.length; i += TAGS_PER_PURGE) {
      calls.push({ tags: tags.slice(i, i + TAGS_PER_PURGE) })
    }
  for (const options of calls) {
    try {
      const result = await cache.purge(options)
      if (!result.success) {
        log.warn("Cloudflare refused to purge the Worker's edge cache", result.errors)
      }
    } catch (error) {
      log.warn("Couldn't purge the Worker's edge cache", error)
    }
  }
}

/** Whether the edge cache may answer this request, or store the answer. */
export function isEdgeCacheable(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false
  const url = new URL(request.url)
  if (isOriginPath(url.pathname)) return false
  const { headers } = request
  if (headers.has("RSC") || url.searchParams.has("_rsc")) return false
  const uncached = ["Authorization", "Upgrade", "x-prerender-revalidate", "Next-Action"]
  if (uncached.some((name) => headers.has(name))) {
    return false
  }
  const cookies = headers.get("Cookie") ?? ""
  return !PERSONAL_COOKIES.some((name) => hasCookie(cookies, name))
}

/**
 * Whether the gateway hands this request to the cached entrypoint: anything the cache may
 * answer, and `/next/revalidate-all`, so its purge reaches that entrypoint's cache (a
 * purge only clears the cache of the entrypoint that calls it). A POST is never cached.
 */
export function goesToCachedSite(request: Request): boolean {
  return isEdgeCacheable(request) || isRevalidateAll(request)
}

/**
 * Whether the cache may keep this answer: a 2xx or 3xx the app gave caching headers to.
 * Workers Cache keeps a response without `Cache-Control` too, by heuristic (a 200 for two
 * hours, a 404 for three minutes), and the entry answers every reader of that URL, so an
 * empty 404 the Worker gives one request would blank the page for everyone.
 */
function isKeepable(response: Response): boolean {
  if (response.status < 200 || response.status >= 400) return false
  return response.headers.has("CDN-Cache-Control") || response.headers.has("Cache-Control")
}

/**
 * The cached entrypoint's answer: only what `isKeepable` allows is left cacheable, so an
 * error or a failed database read doesn't stick, and what's kept is tagged with its path. A
 * successful `/next/revalidate-all` purges the paths it names, or the whole cache.
 */
export async function afterCachedSite(
  request: Request,
  response: Response,
  cache: EdgeCache | undefined,
  log: Pick<Console, "warn"> = console,
): Promise<Response> {
  if (isRevalidateAll(request)) {
    if (response.ok) await purge(cache, tagsToPurge(request), log)
    return response
  }
  if (isKeepable(response)) {
    const tagged = new Response(response.body, response)
    tagged.headers.append("Cache-Tag", edgeCacheTags(new URL(request.url).pathname).join(","))
    return tagged
  }
  const uncached = new Response(response.body, response)
  uncached.headers.set("Cache-Control", "no-store")
  uncached.headers.delete("CDN-Cache-Control")
  return uncached
}

/**
 * Requests this isolate has handled, through either entrypoint, so a timing can say whether
 * it was a cold start. A request the gateway hands to `CachedSite` counts once for each.
 */
let isolateRequests = 0

/**
 * Adds a `Server-Timing` entry, `cached-site`, to the cached entrypoint's answer: how long it
 * took to have the answer's headers (a page that streams renders the rest after that, and a
 * Worker's clock only moves on I/O, so this leaves out CPU work such as compiling a cold
 * isolate), the data center it ran in, and how many requests its isolate has handled (1 is a
 * cold start). An edge-cache miss takes far longer than the same request served by the
 * gateway, and these say whether that time is spent in this entrypoint or in the cache tiers
 * around it. Stored with the page, so on a HIT it describes the request that filled it.
 */
export function withServerTiming(
  request: Request,
  response: Response,
  startedAt: number,
  now: number = Date.now(),
): Response {
  isolateRequests += 1
  const colo = (request as Request & { cf?: { colo?: unknown } }).cf?.colo
  const desc = [typeof colo === "string" ? colo : "unknown", `isolate request ${isolateRequests}`]
  const timed = new Response(response.body, response)
  timed.headers.append(
    "Server-Timing",
    `cached-site;dur=${Math.max(0, now - startedAt)};desc="${desc.join(", ")}"`,
  )
  return timed
}

/**
 * The gateway: hands what the edge cache may hold to `CachedSite` through `ctx.exports`,
 * which goes through the cache, and runs everything else itself.
 */
export function withEdgeCache<Env extends WorkerEnv>(
  handler: WorkerHandler<Env>,
): WorkerHandler<Env> {
  return {
    fetch(request, env, ctx) {
      isolateRequests += 1
      const cached = (ctx as GatewayContext | undefined)?.exports?.CachedSite
      if (cached && goesToCachedSite(request)) return cached.fetch(request)
      return handler.fetch(request, env, ctx)
    },
  }
}
