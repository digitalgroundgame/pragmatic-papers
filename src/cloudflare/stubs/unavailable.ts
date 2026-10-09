/**
 * Stands in for the packages in `WORKER_STUBS` (`../withCloudflare.ts`) in the Cloudflare
 * Worker build. The Worker renders the public site; the code paths that need these
 * (migrations and schema push, resizing uploads, the updateRecommendations job) run on
 * Coolify, so calling one in the Worker is a bug and throws.
 */
const unavailable = (name: string) => () => {
  throw new Error(`${name} isn't available in the Cloudflare Worker build`)
}

// `drizzle-kit/api`, which @payloadcms/drizzle imports for migrations and schema push.
export const pushSchema = unavailable("drizzle-kit/api")
export const generateDrizzleJson = unavailable("drizzle-kit/api")
export const generateMigration = unavailable("drizzle-kit/api")
export const upPgSnapshot = unavailable("drizzle-kit/api")

// `sharp`, through `../sharp.ts`.
export default unavailable("sharp")

// `@google-analytics/data`, which only the updateRecommendations job uses.
export class BetaAnalyticsDataClient {
  constructor() {
    unavailable("@google-analytics/data")()
  }
}
