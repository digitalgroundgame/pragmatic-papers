import type { User } from "@/payload-types"
import type { Payload } from "payload"

/** A kind of notification a user can mute: help docs, an article published, a review asked for. */
export interface NotificationType {
  /** Stable: muted types are stored by it. */
  slug: string
  /** Shown in the bell's settings, e.g. "Docs". */
  label: string
  description?: string
}

/** One notification as the bell shows it. */
export interface NotificationItem {
  /** The source's type slug. */
  type: string
  /** Unique within its type; read state is kept by `type:id`. */
  id: string
  title: string
  summary?: string
  /** Where clicking it goes; opens in a new tab. */
  href: string
  /** ISO date-time it happened or was published. */
  date: string
  /** A thumbnail shown beside the title. */
  image?: { url: string; alt: string }
}

/**
 * Where one type of notification comes from. The docs plugin is the first source; anything
 * else that should tell staff something (an article published, a review requested) adds its
 * own. Runs on the server for each admin page, so cache anything shared between users.
 */
export interface NotificationSource {
  type: NotificationType
  /** What `user` should see, newest first. */
  itemsFor: (args: { payload: Payload; user: User }) => Promise<Omit<NotificationItem, "type">[]>
  /** A footer link to everything of this type, e.g. `/docs`. */
  index?: { label: string; href: string }
}

export interface NotificationsOptions {
  sources: NotificationSource[]
}

/** What the bell keeps in each user's Payload preferences. */
export interface NotificationsPreference {
  /** `type:id` of each item opened. */
  read: string[]
  /** Type slugs the user turned off. */
  muted: string[]
}
