import { env, type Integration } from "../types"

/**
 * What to purge from a zone's cache, in the shapes Cloudflare's purge endpoint takes. Every
 * plan accepts all four (developers.cloudflare.com/cache/how-to/purge-cache/), but they are
 * rate-limited differently: hostname, prefix and everything purges share a per-account bucket
 * that is only 5 requests a minute on the Free plan, while single-file purges are counted per
 * URL and are far more generous.
 */
export type PurgeTarget =
  { hosts: string[] } | { prefixes: string[] } | { files: string[] } | { everything: true }

export interface CloudflareZoneIntegration extends Integration {
  /** The zone's ID, or null when unset. Not a secret, but there's nothing to purge without it. */
  zoneId(): string | null
  /**
   * Purge part of the zone's edge cache. Resolves once Cloudflare has accepted the request,
   * which is all its API reports: a 200 says the purge was queued, not that anything was
   * cached. Throws when the connection is not configured or Cloudflare refuses the request,
   * with Cloudflare's own error messages and never the token.
   */
  purge(target: PurgeTarget, opts?: { fetchImpl?: typeof fetch }): Promise<void>
}

export interface CloudflareZoneOptions {
  id: string
  label: string
  /** Environment variable holding the zone's ID (the zone's Overview page in the dashboard). */
  zoneEnv: string
  /** Environment variable holding an API token scoped to **Zone → Cache Purge** on that zone. */
  tokenEnv: string
}

const API = "https://api.cloudflare.com/client/v4"

interface CloudflareEnvelope {
  success?: boolean
  errors?: { code?: number; message?: string }[]
}

function body(target: PurgeTarget): Record<string, unknown> {
  if ("everything" in target) return { purge_everything: true }
  return target
}

/**
 * A connection to one Cloudflare zone, for purging its cache. Purging is the only thing it
 * does: the zone's rules are kept in step by `scripts/cloudflare-rules.ts` with tokens of
 * their own (`cloudflare/README.md`), and those never reach the running site.
 */
export function cloudflareZone({
  id,
  label,
  zoneEnv,
  tokenEnv,
}: CloudflareZoneOptions): CloudflareZoneIntegration {
  const zoneId = (): string | null => env(zoneEnv)
  return {
    id,
    label,
    service: "Cloudflare",
    describe: () => {
      const zone = zoneId()
      return zone ? `cloudflare:zone/${zone}` : "cloudflare:(no zone configured)"
    },
    required: [zoneEnv, tokenEnv],
    zoneId,
    async purge(target, { fetchImpl = fetch } = {}) {
      const zone = zoneId()
      const token = env(tokenEnv)
      if (!zone || !token) {
        throw new Error(`Cloudflare purge needs ${[zoneEnv, tokenEnv].join(" and ")}`)
      }

      const response = await fetchImpl(`${API}/zones/${encodeURIComponent(zone)}/purge_cache`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body(target)),
      })

      let envelope: CloudflareEnvelope = {}
      try {
        envelope = (await response.json()) as CloudflareEnvelope
      } catch {
        // A proxy's HTML error page, say. The status below still says what happened.
      }

      if (!response.ok || envelope.success === false) {
        const reasons = (envelope.errors ?? [])
          .map((e) => [e.code, e.message].filter(Boolean).join(" "))
          .filter(Boolean)
        throw new Error(
          `Cloudflare purge failed (HTTP ${response.status})${reasons.length ? `: ${reasons.join("; ")}` : ""}`,
        )
      }
    },
  }
}
