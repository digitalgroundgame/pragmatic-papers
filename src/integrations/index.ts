import { blueskyAccounts } from "./bluesky"
import { cloudflareZone } from "./cloudflare"
import { githubRepo } from "./github"
import { shopifyStore } from "./shopify"
import { xAccounts } from "./x"
import { youtubeChannels } from "./youtube"
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
 * Our YouTube channels, which the ticker watches for a live or upcoming broadcast.
 * A plain Data API key from any Google Cloud project with "YouTube Data API v3" enabled; it
 * reads public data only.
 */
export const youtubeLive = youtubeChannels({
  id: "youtube-live",
  label: "YouTube channels",
  channelsEnv: "YOUTUBE_CHANNEL_IDS",
  keyEnv: "YOUTUBE_API_KEY",
})

/** Our Bluesky accounts, whose posts run in the ticker. */
export const blueskyPosts = blueskyAccounts({
  id: "bluesky-posts",
  label: "Bluesky posts",
  defaultHandles: ["thepragmaticpapers.bsky.social"],
  handlesEnv: "BLUESKY_HANDLES",
})

/**
 * Our X accounts, whose posts run in the ticker. Reading posts needs a paid X API plan or
 * pay-per-use credits on the app behind the token.
 */
export const xPosts = xAccounts({
  id: "x-posts",
  label: "X posts",
  defaultUsernames: ["PragPapers"],
  usernamesEnv: "X_USERNAMES",
  tokenEnv: "X_BEARER_TOKEN",
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
  youtubeLive,
  blueskyPosts,
  xPosts,
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
