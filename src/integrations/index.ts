import { cloudflareZone } from "./cloudflare"
import { githubRepo } from "./github"
import { shopifyStore } from "./shopify"
import { integrationStatus, type Integration, type IntegrationStatus } from "./types"

/**
 * Every outside connection this site has, declared in one place.
 *
 * Adding one: declare it here, next to its peers, and export it for its feature to import.
 */

/**
 * court-tracker — the federal judiciary dataset behind the Federal Courts interactive. A
 * private repository that publishes a tagged, immutable release per data build; the
 * interactive's feed adapter (`interactives/federal-courts/feed.ts`) is what knows the shape
 * of what it publishes.
 */
export const courtTracker = githubRepo({
  id: "github-court-tracker",
  label: "court-tracker data feed",
  defaultRepo: "digitalgroundgame/court-tracker",
  repoEnv: "COURT_TRACKER_REPO",
  tokenEnv: "COURT_TRACKER_GITHUB_TOKEN",
})

export { shopifyStore }

/**
 * The Cloudflare zone in front of every environment — production, staging and each PR
 * preview share it (`cloudflare/README.md`). Used to purge the edge cache when an editor's
 * save changes what anonymous readers should see (`src/hooks/purgeEdgeCache.ts`).
 *
 * Its token is not `CLOUDFLARE_API_TOKEN` (CI's, which deploys Storybook) nor the rules
 * tokens: a token scoped to **Zone → Cache Purge** on this zone only, set at runtime.
 */
export const cloudflareCache = cloudflareZone({
  id: "cloudflare-cache",
  label: "Cloudflare edge cache",
  zoneEnv: "CLOUDFLARE_ZONE_ID",
  tokenEnv: "CLOUDFLARE_PURGE_TOKEN",
})

/** Declaration order is display order. */
export const INTEGRATIONS: readonly Integration[] = [courtTracker, shopifyStore, cloudflareCache]

export function getIntegration(id: string): Integration | null {
  return INTEGRATIONS.find((i) => i.id === id) ?? null
}

/** What every connection reports about itself right now. Names of missing vars, never values. */
export function integrationStatuses(): IntegrationStatus[] {
  return INTEGRATIONS.map(integrationStatus)
}

export type { Integration, IntegrationStatus } from "./types"
export { describeStatus, integrationStatus } from "./types"
