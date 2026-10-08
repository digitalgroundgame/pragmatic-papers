/**
 * The Cloudflare Worker's fetch handler, around OpenNext's. The Worker is built without
 * `src/app/(payload)`, so whatever only Coolify serves goes there, at `ORIGIN_URL`:
 *
 * - the admin panel and Payload's REST/GraphQL API, media files (`/api/media/file/…`)
 *   included;
 * - `/_next/static/…` files the Worker's assets don't have, which are the admin panel's
 *   (Cloudflare serves the Worker's own assets before the Worker runs);
 * - next/image's reads of those media files, which OpenNext makes through the `ASSETS`
 *   binding rather than over HTTP.
 *
 * It also points Payload at Hyperdrive, when the Worker has the binding.
 */

/** The Worker's bindings and variables that this module reads. */
export interface WorkerEnv {
  ASSETS: { fetch: (input: Request | URL | string) => Promise<Response> }
  HYPERDRIVE?: { connectionString: string }
  /** Where the admin panel and Payload's API are served: the Coolify deployment. */
  ORIGIN_URL?: string
}

export interface WorkerHandler<Env extends WorkerEnv = WorkerEnv> {
  fetch(request: Request, env: Env, ctx: unknown): Promise<Response>
}

const ORIGIN_PREFIXES = ["/admin/", "/api/", "/_next/static/"]

export function isOriginPath(pathname: string): boolean {
  return pathname === "/admin" || ORIGIN_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/** The same request, sent to the origin instead. Redirects come back to the browser. */
export function toOrigin(request: Request, origin: string): Request {
  const url = new URL(request.url)
  const target = new URL(url.pathname + url.search, origin)
  const forwarded = new Request(target, request)
  forwarded.headers.set("X-Forwarded-Host", url.host)
  return new Request(forwarded, { redirect: "manual" })
}

export function withOrigin<Env extends WorkerEnv>(handler: WorkerHandler<Env>): WorkerHandler<Env> {
  return {
    async fetch(request, env, ctx) {
      // Payload reads it when its config first loads, on the isolate's first request.
      if (env.HYPERDRIVE) process.env.DATABASE_URI = env.HYPERDRIVE.connectionString

      const origin = env.ORIGIN_URL
      if (!origin) return handler.fetch(request, env, ctx)

      if (isOriginPath(new URL(request.url).pathname)) return fetch(toOrigin(request, origin))

      const assets = env.ASSETS
      return handler.fetch(
        request,
        {
          ...env,
          ASSETS: {
            // OpenNext's image handler passes a URL, not a Request.
            fetch: (input: Request | URL | string) => {
              const assetRequest = input instanceof Request ? input : new Request(input)
              return isOriginPath(new URL(assetRequest.url).pathname)
                ? fetch(toOrigin(assetRequest, origin))
                : assets.fetch(input)
            },
          },
        },
        ctx,
      )
    },
  }
}
