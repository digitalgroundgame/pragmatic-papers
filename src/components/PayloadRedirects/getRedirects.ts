import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import { unstable_cache } from "next/cache"

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getRedirects(depth = 1) {
  const payload = await getPayloadConfig()

  const { docs: redirects } = await payload.find({
    collection: "redirects",
    depth,
    limit: 0,
    pagination: false,
  })

  return redirects
}

/**
 * Returns a unstable_cache function mapped with the cache tag for 'redirects'.
 *
 * Cache all redirects together to avoid multiple fetches. Uncached in development, for the
 * reason `getCachedGlobal` gives.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getCachedRedirects = () =>
  process.env.NODE_ENV === "development"
    ? async () => getRedirects()
    : unstable_cache(async () => getRedirects(), ["redirects"], {
        tags: ["redirects"],
      })
