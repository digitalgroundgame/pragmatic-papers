import type { User } from "@/payload-types"
import type { ServerProps } from "payload"
import type React from "react"

import { NotificationsBellClient } from "./NotificationsBell.client"
import type { NotificationItem, NotificationsOptions } from "./types"
import { parsePreference, PREFERENCE_KEY } from "./unread"

/** The dropdown shows this many of each type. */
const PER_TYPE = 8

/**
 * The admin header's bell. Who sees what is up to each source, so the same sources can later
 * serve readers on the site. Gathers each source's items for the user and reads their read and
 * muted state from preferences here, so the count is right on first paint.
 */
export async function NotificationsBell({ payload, user }: ServerProps): Promise<React.ReactNode> {
  if (!user) return null
  const options = payload.config.custom?.notifications as NotificationsOptions | undefined
  const sources = options?.sources ?? []
  if (sources.length === 0) return null

  const [lists, preferences] = await Promise.all([
    Promise.all(
      sources.map(async (source): Promise<NotificationItem[]> => {
        try {
          const items = await source.itemsFor({ payload, user: user as User })
          return items.slice(0, PER_TYPE).map((item) => ({ ...item, type: source.type.slug }))
        } catch (err) {
          payload.logger.error({ err, type: source.type.slug }, "A notification source failed")
          return []
        }
      }),
    ),
    payload.find({
      collection: "payload-preferences",
      depth: 0,
      limit: 1,
      pagination: false,
      where: {
        and: [
          { key: { equals: PREFERENCE_KEY } },
          { "user.relationTo": { equals: user.collection } },
          { "user.value": { equals: user.id } },
        ],
      },
    }),
  ])

  return (
    <NotificationsBellClient
      indexes={sources.flatMap((source) =>
        source.index ? [{ type: source.type.slug, ...source.index }] : [],
      )}
      items={lists.flat()}
      joinedAt={user.createdAt}
      preference={parsePreference(preferences.docs[0]?.value)}
      types={sources.map((source) => source.type)}
    />
  )
}
