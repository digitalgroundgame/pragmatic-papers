import type { Config } from "@/payload-types"

import { unstable_cache } from "next/cache"
import { cache } from "react"

import { getPayloadConfig } from "./getPayloadConfig"

type Global = keyof Config["globals"]

const getGlobal = cache(async function getGlobalCached<T extends Global>(
  slug: T,
  depth = 0,
): Promise<Config["globals"][T]> {
  const payload = await getPayloadConfig()

  const global = await payload.findGlobal({
    slug,
    depth,
  })

  return global as Config["globals"][T]
})

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug.
 *
 * In development it skips `unstable_cache` and reads the database on every request
 * (`React.cache` still dedupes within one). `next dev` keeps that cache on disk in
 * `.next/dev/cache`, untimed, and only the globals' own hooks inside the Next process clear
 * it — so a seed, `dev:db-nuke`, `dev:db-fresh` or a script writing the globals left the
 * header and footer showing an earlier database's nav across restarts (#971).
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getCachedGlobal = <T extends Global>(slug: T, depth = 0) =>
  process.env.NODE_ENV === "development"
    ? async () => getGlobal(slug, depth)
    : unstable_cache(async () => getGlobal(slug, depth), [slug, String(depth)], {
        tags: [`global_${slug}`],
      })
