import { getPayloadClient } from "@/data/payload"
import { unstable_cache } from "next/cache"

import type { Redirect } from "@/payload-types"

async function readRedirects(): Promise<Redirect[]> {
  const payload = await getPayloadClient()

  const { docs } = await payload.find({
    collection: "redirects",
    depth: 1,
    limit: 0,
    pagination: false,
  })

  return docs
}

/**
 * Every redirect, cached together under the tag `redirects` (cleared by
 * `revalidateRedirects`) so a request reads them once. Uncached in development, for the
 * reason `getGlobal` gives.
 */
export function getRedirects(): Promise<Redirect[]> {
  if (process.env.NODE_ENV === "development") return readRedirects()
  return unstable_cache(readRedirects, ["redirects"], { tags: ["redirects"] })()
}
