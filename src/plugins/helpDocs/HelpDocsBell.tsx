import { helpDocs } from "@/docs"
import type { User } from "@/payload-types"
import type { ServerProps } from "payload"
import type React from "react"

import { HelpDocsBellClient } from "./HelpDocsBell.client"
import { HELP_DOCS_PREFERENCE, helpDocsFor, readFromPreference, unreadHelpDocs } from "./unread"

/**
 * The admin header's help bell. Picks the articles the user's roles should see and reads which
 * they've opened from their preferences here, so the unread count is right on first paint.
 */
export async function HelpDocsBell({ payload, user }: ServerProps): Promise<React.ReactNode> {
  const docs = helpDocsFor(helpDocs, user as User | undefined)
  if (!user || docs.length === 0) return null

  const { docs: preferences } = await payload.find({
    collection: "payload-preferences",
    depth: 0,
    limit: 1,
    pagination: false,
    where: {
      and: [
        { key: { equals: HELP_DOCS_PREFERENCE } },
        { "user.relationTo": { equals: user.collection } },
        { "user.value": { equals: user.id } },
      ],
    },
  })
  const read = readFromPreference(preferences[0]?.value)

  return (
    <HelpDocsBellClient
      docs={docs}
      initialUnread={unreadHelpDocs(docs, read, user.createdAt)}
      read={read}
    />
  )
}
