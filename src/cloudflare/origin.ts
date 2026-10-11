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

/** Next's default `images.minimumCacheTTL`, which its image optimizer on Coolify sends. */
const IMAGE_MAX_AGE = 14400

/**
 * A resized image with the caching Next's optimizer gives it. OpenNext's image handler sets
 * Cache-Control only on images it can call immutable, and media from Payload never is, so
 * the rest went out without one and every view resized the image again.
 */
export function withImageCaching(pathname: string, response: Response): Response {
  if (pathname !== "/_next/image" || !response.ok || response.headers.has("Cache-Control")) {
    return response
  }
  const cached = new Response(response.body, response)
  cached.headers.set("Cache-Control", `public, max-age=${IMAGE_MAX_AGE}, must-revalidate`)
  return cached
}

export function withOrigin<Env extends WorkerEnv>(handler: WorkerHandler<Env>): WorkerHandler<Env> {
  return {
    async fetch(request, env, ctx) {
      // Payload reads it when its config first loads, on the isolate's first request.
      if (env.HYPERDRIVE) process.env.DATABASE_URI = env.HYPERDRIVE.connectionString

      const { pathname } = new URL(request.url)
      const origin = env.ORIGIN_URL
      if (!origin) return withImageCaching(pathname, await handler.fetch(request, env, ctx))

      if (isOriginPath(pathname)) return fetch(toOrigin(request, origin))

      const assets = env.ASSETS
      const response = await handler.fetch(
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
      return withImageCaching(pathname, response)
    },
  }
}

/**
 * An error with what caused it, for the Worker's logs. Workers logs print only an error's
 * message and stack, so Drizzle's "Failed query" would arrive without the database error
 * that caused it.
 */
export function withCauses(value: unknown): unknown {
  if (!(value instanceof Error) || value.cause === undefined) return value
  const lines = [value.stack ?? String(value)]
  let cause: unknown = value.cause
  for (let depth = 0; cause !== undefined && depth < 5; depth++) {
    lines.push(
      `Caused by: ${cause instanceof Error ? (cause.stack ?? String(cause)) : String(cause)}`,
    )
    cause = cause instanceof Error ? cause.cause : undefined
  }
  return lines.join("\n")
}

/** Makes `console.error` and `console.warn` print each error's causes too. */
export function logErrorCauses(target: Pick<Console, "error" | "warn"> = console): void {
  for (const level of ["error", "warn"] as const) {
    const log = target[level].bind(target)
    target[level] = (...args: unknown[]) => log(...args.map(withCauses))
  }
}
