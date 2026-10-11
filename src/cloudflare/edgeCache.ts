/**
 * The Worker's edge cache: Cloudflare's Workers Cache, which answers a request from the
 * edge before the Worker runs. It's switched on for one entrypoint, `CachedSite`
 * (`worker.mjs`, `exports` in wrangler.jsonc), and the default entrypoint is a gateway in
 * front of it that decides what may go through.
 *
 * Workers Cache keys a response by path and query only, never by cookie, so anything
 * personal has to skip it: Payload's login, Next's draft mode, anything with an
 * Authorization header. So do OpenNext's own revalidation requests
 * (`x-prerender-revalidate`, through `WORKER_SELF_REFERENCE`), which must re-render, and
 * navigations (RSC requests): Next varies those on the router's state and checks `_rsc`
 * against it, and OpenNext already answers them from its R2 cache by route. What's left
 * is full page loads and resized images, the same set the zone cache holds for Coolify,
 * kept for as long as `CDN-Cache-Control` says.
 *
 * The cache belongs to the Worker version, so a deploy starts it empty, and
 * `/next/revalidate-all` empties it after every save.
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
  purge?: (options: { purgeEverything: true }) => Promise<EdgeCachePurgeResult>
}

/** Cookies that make a page personal: Payload's login and Next's draft mode. */
const PERSONAL_COOKIES = ["payload-token", "__prerender_bypass"]

const hasCookie = (cookies: string, name: string): boolean =>
  cookies.split(";").some((cookie) => cookie.trim().startsWith(`${name}=`))

export const REVALIDATE_ALL_PATH = "/next/revalidate-all"

const isRevalidateAll = (request: Request): boolean =>
  request.method === "POST" && new URL(request.url).pathname === REVALIDATE_ALL_PATH

/** Whether the edge cache may answer this request, or store the answer. */
export function isEdgeCacheable(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false
  const url = new URL(request.url)
  if (isOriginPath(url.pathname)) return false
  const { headers } = request
  if (headers.has("RSC") || url.searchParams.has("_rsc")) return false
  if (["Authorization", "Upgrade", "x-prerender-revalidate"].some((name) => headers.has(name))) {
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
 * error or a failed database read doesn't stick, and a successful `/next/revalidate-all`
 * empties the cache.
 */
export async function afterCachedSite(
  request: Request,
  response: Response,
  cache: EdgeCache | undefined,
  log: Pick<Console, "warn"> = console,
): Promise<Response> {
  if (isRevalidateAll(request)) {
    if (response.ok) {
      if (typeof cache?.purge === "function") {
        try {
          const result = await cache.purge({ purgeEverything: true })
          if (!result.success) {
            log.warn("Cloudflare refused to purge the Worker's edge cache", result.errors)
          }
        } catch (error) {
          log.warn("Couldn't purge the Worker's edge cache", error)
        }
      } else {
        log.warn("The Worker's edge cache can't be purged here (no ctx.cache.purge)")
      }
    }
    return response
  }
  if (isKeepable(response)) return response
  const uncached = new Response(response.body, response)
  uncached.headers.set("Cache-Control", "no-store")
  uncached.headers.delete("CDN-Cache-Control")
  return uncached
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
      const cached = (ctx as GatewayContext | undefined)?.exports?.CachedSite
      if (cached && goesToCachedSite(request)) return cached.fetch(request)
      return handler.fetch(request, env, ctx)
    },
  }
}
