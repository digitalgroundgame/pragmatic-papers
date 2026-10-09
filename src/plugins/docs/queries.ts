import { isStaff } from "@/access/roles"
import type { User } from "@/payload-types"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import { draftMode, headers } from "next/headers"
import { unstable_cache } from "next/cache"
import { cache } from "react"

import { DOCS_SLUG } from "./collection"
import { DOCS_CACHE_TAG } from "./revalidateDoc"
import { syncVersion } from "./syncVersion"

/**
 * Who a query reads as. Readers get what the collection's read access gives a visitor: published
 * docs with no audience. Staff get every published doc, so their copy is cached separately.
 */
interface Reader {
  staff?: boolean
}

const PUBLISHED = { _status: { equals: "published" } } as const

const findPublishedDocs = async (staff: boolean) => {
  const payload = await getPayloadConfig()
  const { docs } = await payload.find({
    collection: DOCS_SLUG,
    depth: 0,
    draft: false,
    limit: 1000,
    overrideAccess: staff,
    pagination: false,
    sort: "-publishedAt",
    select: { slug: true, title: true, summary: true, publishedAt: true, audience: true },
    where: staff ? PUBLISHED : undefined,
  })
  return docs
}

/** Every published doc, newest first, without its content: the /docs index and the bell. */
export const queryPublishedDocs = ({ staff = false }: Reader = {}): ReturnType<
  typeof findPublishedDocs
> =>
  unstable_cache(
    () => findPublishedDocs(staff),
    [staff ? "docs-published-staff" : "docs-published", syncVersion()],
    { tags: [DOCS_CACHE_TAG] },
  )()

const findDoc = async (slug: string, { draft = false, staff = false }) => {
  const payload = await getPayloadConfig()
  const { docs } = await payload.find({
    collection: DOCS_SLUG,
    depth: 2,
    draft,
    limit: 1,
    overrideAccess: draft || staff,
    pagination: false,
    where: draft || !staff ? { slug: { equals: slug } } : { slug: { equals: slug }, ...PUBLISHED },
  })
  return docs[0] ?? null
}

const findPublishedDoc = (slug: string, staff: boolean) =>
  unstable_cache(
    () => findDoc(slug, { staff }),
    [staff ? "doc-staff" : "doc", slug, syncVersion()],
    { tags: [DOCS_CACHE_TAG] },
  )()

/** Whether the person asking is signed in to the admin as staff. */
export const isStaffReader = cache(async (): Promise<boolean> => {
  const payload = await getPayloadConfig()
  const { user } = await payload.auth({ headers: await headers() })
  return isStaff(user as User | null)
})

/**
 * One doc with its media; cached until a doc is saved, except in a draft preview. A doc written
 * for some roles is found only for staff, so a visitor gets the 404 a missing doc would.
 */
export const queryDocBySlug = cache(async (slug: string) => {
  const { isEnabled: draft } = await draftMode()
  if (draft) return findDoc(slug, { draft })
  const doc = await findPublishedDoc(slug, false)
  if (doc || !(await isStaffReader())) return doc
  return findPublishedDoc(slug, true)
})
