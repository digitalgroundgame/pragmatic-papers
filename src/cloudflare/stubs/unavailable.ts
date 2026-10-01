/**
 * #916 spike: stands in for a server package a Cloudflare Worker can't load, under a
 * Turbopack `resolveAlias` that `next.config.ts` sets only when `OPENNEXT_BUILD=true`.
 * The Worker renders the public site; the code paths that need these (migrations and
 * schema push for `drizzle-kit/api`, resizing uploads for `sharp`) run on Coolify.
 */
const unavailable = (name: string) => () => {
  throw new Error(`${name} isn't available in the Cloudflare Worker build (#916)`)
}

export const pushSchema = unavailable("drizzle-kit/api")
export const generateDrizzleJson = unavailable("drizzle-kit/api")
export const generateMigration = unavailable("drizzle-kit/api")
export const upPgSnapshot = unavailable("drizzle-kit/api")

// `import sharp from "sharp"` in payload.config.ts.
export default unavailable("sharp")

// `@google-analytics/data`, which only the updateRecommendations job uses.
export class BetaAnalyticsDataClient {
  constructor() {
    unavailable("@google-analytics/data")()
  }
}
