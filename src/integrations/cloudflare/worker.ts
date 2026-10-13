import { env, type Integration } from "../types"

export interface CloudflareWorkerIntegration extends Integration {
  /** The Worker's URL, or null when unset. */
  url(): string | null
  /**
   * Throw away the pages the Worker has cached, through its `/next/revalidate-all`, so each
   * renders again from the database on its next request: the given paths and, with `shared`,
   * every page that lists articles, volumes or contributors, or every page when neither is
   * given. Resolves once the Worker has answered; throws when the connection is not
   * configured or the Worker refuses, with the status and never the secret.
   */
  revalidateAll(opts?: RevalidateOptions): Promise<void>
}

export interface RevalidateOptions {
  fetchImpl?: typeof fetch
  paths?: readonly string[]
  shared?: boolean
}

/** More paths than this purge everything instead, so the request's URL stays short. */
export const MAX_PURGE_PATHS = 100

export interface CloudflareWorkerOptions {
  id: string
  label: string
  /** Environment variable holding the Worker's URL (its workers.dev address or custom domain). */
  urlEnv: string
  /** Environment variable holding the secret the Worker checks: both sides' `PAYLOAD_SECRET`. */
  secretEnv: string
}

/** Long enough for a cold isolate; short enough that a hung Worker doesn't pile up flushes. */
const TIMEOUT_MS = 10_000

/**
 * A connection to the Cloudflare Worker serving this site's public pages (`src/cloudflare/`).
 * Its R2 and D1 cache is its own, so Next's revalidation on this deployment doesn't reach it.
 */
export function cloudflareWorker({
  id,
  label,
  urlEnv,
  secretEnv,
}: CloudflareWorkerOptions): CloudflareWorkerIntegration {
  const url = (): string | null => env(urlEnv)
  return {
    id,
    label,
    service: "Cloudflare",
    describe: () => {
      const target = url()
      return target ? `worker:${target}` : "worker:(no URL configured)"
    },
    required: [urlEnv, secretEnv],
    url,
    async revalidateAll({ fetchImpl = fetch, paths = [], shared = false } = {}) {
      const base = url()
      const secret = env(secretEnv)
      if (!base || !secret) {
        throw new Error(`Worker revalidation needs ${[urlEnv, secretEnv].join(" and ")}`)
      }

      const target = new URL("/next/revalidate-all", base)
      // A save, not a deploy: the Worker skips its deploy-time seeding.
      target.searchParams.set("save", "1")
      if (paths.length <= MAX_PURGE_PATHS) {
        for (const path of paths) target.searchParams.append("path", path)
        if (shared) target.searchParams.set("shared", "1")
      }
      const response = await fetchImpl(target, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`Worker revalidation failed (HTTP ${response.status})`)
    },
  }
}
