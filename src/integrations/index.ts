import { cloudflareWorker, cloudflareZone } from "./cloudflare"
import { githubRepo } from "./github"
import { shopifyStore } from "./shopify"
import { integrationStatus, type Integration, type IntegrationStatus } from "./types"
import { unsplashApp } from "./unsplash"

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

/**
 * The Cloudflare Worker serving the public pages (`src/cloudflare/`), when this deployment
 * has one in front of it. Its cache (R2 and D1) is separate from this deployment's Next cache
 * and from Cloudflare's edge, so an editor's save clears it too (`src/hooks/purgeEdgeCache.ts`).
 *
 * `WORKER_URL` is set only on the Coolify app whose database the Worker reads (staging's
 * Worker: staging). The secret is `PAYLOAD_SECRET`, which the Worker shares with that app.
 */
export const cloudflareWorkerCache = cloudflareWorker({
  id: "cloudflare-worker",
  label: "Cloudflare Worker cache",
  urlEnv: "WORKER_URL",
  secretEnv: "PAYLOAD_SECRET",
})

/**
 * Unsplash — the photo library editors can search from Media's upload controls and save
 * into Media (`collections/Media/components/Unsplash`). The key is the application's Access
 * Key; `UNSPLASH_APP_NAME` is its name on unsplash.com/oauth/applications, used for the
 * referral parameters Unsplash's guidelines ask every link back to carry.
 */
export const unsplash = unsplashApp({
  id: "unsplash",
  label: "Unsplash photo search",
  keyEnv: "UNSPLASH_ACCESS_KEY",
  appNameEnv: "UNSPLASH_APP_NAME",
  defaultAppName: "pragmatic_papers_development",
})

/** Declaration order is display order. */
export const INTEGRATIONS: readonly Integration[] = [
  courtTracker,
  shopifyStore,
  cloudflareCache,
  cloudflareWorkerCache,
  unsplash,
]

export function getIntegration(id: string): Integration | null {
  return INTEGRATIONS.find((i) => i.id === id) ?? null
}

/** What every connection reports about itself right now. Names of missing vars, never values. */
export function integrationStatuses(): IntegrationStatus[] {
  return INTEGRATIONS.map(integrationStatus)
}

export type { Integration, IntegrationStatus } from "./types"
export { describeStatus, integrationStatus } from "./types"
