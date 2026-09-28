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
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getCachedGlobal = <T extends Global>(slug: T, depth = 0) =>
  unstable_cache(async () => getGlobal(slug, depth), [slug, String(depth)], {
    tags: [`global_${slug}`],
  })
