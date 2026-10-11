import type { Config } from "@/payload-types"

import { unstable_cache } from "next/cache"
import { cache } from "react"

import { getPayloadClient } from "@/data/payload"

type Global = keyof Config["globals"]

const readGlobal = cache(async function readGlobalUncached<T extends Global>(
  slug: T,
  depth = 0,
): Promise<Config["globals"][T]> {
  const payload = await getPayloadClient()

  const global = await payload.findGlobal({
    slug,
    depth,
  })

  return global as Config["globals"][T]
})

/**
 * A global, cached across requests under the tag `global_<slug>`, which its revalidate hook
 * clears.
 *
 * In development it skips `unstable_cache` and reads the database on every request
 * (`React.cache` still dedupes within one). `next dev` keeps that cache on disk in
 * `.next/dev/cache`, untimed, and only the globals' own hooks inside the Next process clear
 * it — so a seed, `dev:db-nuke`, `dev:db-fresh` or a script writing the globals would leave
 * the header and footer showing an earlier database's nav across restarts.
 */
export function getGlobal<T extends Global>(slug: T, depth = 0): Promise<Config["globals"][T]> {
  if (process.env.NODE_ENV === "development") return readGlobal(slug, depth)
  return unstable_cache(async () => readGlobal(slug, depth), [slug, String(depth)], {
    tags: [`global_${slug}`],
  })()
}
