import { Gutter, SetStepNav } from "@payloadcms/ui"
import { notFound } from "next/navigation"

import { isAdmin } from "@/access/roles"
import type { User } from "@/payload-types"

import { loadNewsletterOverview } from "./load"
import { NewsletterStats } from "./NewsletterStats"

/**
 * System → Newsletter: the whole page, in place of the global's edit view, since there is nothing
 * to edit or save. Read from Listmonk on each visit. Payload already 404s the hidden global for
 * everyone but admins; the check here keeps subscribers' emails behind it if that ever changes.
 */
export async function NewsletterView({ user }: { user?: User | null }): Promise<React.ReactNode> {
  if (!isAdmin(user)) notFound()
  return (
    <Gutter>
      {/* The edit view would set this breadcrumb; this page replaces it. */}
      <SetStepNav nav={[{ label: "Newsletter" }]} />
      <NewsletterStats overview={await loadNewsletterOverview()} />
    </Gutter>
  )
}
