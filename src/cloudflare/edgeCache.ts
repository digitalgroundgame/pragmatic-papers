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

/** `ctx.cache` in the cached entrypoint. */
export interface EdgeCache {
  purge?: (options: { purgeEverything: true }) => Promise<unknown>
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
 * The cached entrypoint's answer: an error isn't kept, so a failed database read doesn't
 * stick for ten minutes, and a successful `/next/revalidate-all` empties the cache.
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
          await cache.purge({ purgeEverything: true })
        } catch (error) {
          log.warn("Couldn't purge the Worker's edge cache", error)
        }
      } else {
        log.warn("The Worker's edge cache can't be purged here (no ctx.cache.purge)")
      }
    }
    return response
  }
  if (response.status < 500) return response
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
