import type { User } from "@/payload-types"
import type { Payload } from "payload"

import type { SitePluginOptions } from "@/utilities/registerPlugin"

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
  /** Where clicking it goes, or its Read more when it has a tour; opens in a new tab. */
  href: string
  /**
   * A link that shows the reader what the item is about, such as a guided tour of a new admin
   * feature (`tourHref` from the tours plugin). The bell offers it as Show me, beside Read more,
   * and opens it in the same tab.
   */
  showMe?: string
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
  /**
   * Whether this source is in the bell at all, checked on each admin page (e.g. a beta switch).
   * Off, its items, its index link and its mute switch are left out. Always, when unset.
   */
  enabled?: (payload: Payload) => boolean | Promise<boolean>
}

/** `enabled` decides whether the bell shows, checked on each admin page (e.g. a beta switch). */
export interface NotificationsOptions extends SitePluginOptions {
  sources: NotificationSource[]
}

/** What the bell keeps in each user's Payload preferences. */
export interface NotificationsPreference {
  /** `type:id` of each item opened. */
  read: string[]
  /** Type slugs the user turned off. */
  muted: string[]
}
