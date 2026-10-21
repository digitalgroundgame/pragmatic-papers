/**
 * The gateway Worker (`gateway.wrangler.jsonc`): a few kilobytes in front of the site's
 * Worker, so that a page Workers Cache already holds is answered without loading the site's
 * 22 MB bundle into a new isolate. It makes the same choice the site's own default
 * entrypoint makes (`withEdgeCache`): what the edge cache may answer goes to `CachedSite`,
 * everything else to the site's default entrypoint, both over service bindings, which
 * Workers Cache treats like any other request to that entrypoint.
 *
 * It serves the same static assets as the site, so Cloudflare answers those before either
 * Worker runs, as it does for the site today.
 */
import { goesToCachedSite } from "./edgeCache"

/** A service binding to one of the site's entrypoints. */
interface SiteBinding {
  fetch(request: Request): Promise<Response>
}

export interface GatewayEnv {
  /** The site's default entrypoint. */
  SITE: SiteBinding
  /** The site's `CachedSite` entrypoint, which has Workers Cache on. */
  CACHED_SITE: SiteBinding
}

/** Requests this isolate has handled, so a timing can say whether it was a cold start. */
let isolateRequests = 0

/**
 * Adds a `Server-Timing` entry, `gateway`, to every answer: how long the site took to give
 * its headers, and how many requests this isolate has handled (1 is a cold start). Unlike the
 * site's `cached-site` entry, which is stored with the page, this one describes the request
 * it's on, so a slow cache hit says whether the gateway was cold.
 */
export function withGatewayTiming(
  response: Response,
  startedAt: number,
  requests: number,
  now: number = Date.now(),
): Response {
  const timed = new Response(response.body, response)
  timed.headers.append(
    "Server-Timing",
    `gateway;dur=${Math.max(0, now - startedAt)};desc="isolate request ${requests}"`,
  )
  return timed
}

export async function handleGatewayRequest(request: Request, env: GatewayEnv): Promise<Response> {
  isolateRequests += 1
  const requests = isolateRequests
  const startedAt = Date.now()
  const site = goesToCachedSite(request) ? env.CACHED_SITE : env.SITE
  const response = await site.fetch(request)
  // A WebSocket's answer carries the socket, which a copied Response would drop.
  if (response.status === 101) return response
  return withGatewayTiming(response, startedAt, requests)
}

const gateway = {
  fetch: (request: Request, env: GatewayEnv): Promise<Response> =>
    handleGatewayRequest(request, env),
}

export default gateway
