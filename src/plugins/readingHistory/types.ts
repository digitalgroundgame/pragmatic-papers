import type { Access, CollectionSlug, PayloadRequest } from "payload"

import type { SitePluginOptions } from "@/utilities/registerPlugin"

/** A row of the users collection, as Payload returns it. */
export type ReadingUser = Record<string, unknown> & { id: number | string }

/** Collections that group the articles: a volume is read once every article in it is. */
export interface ReadingGroups {
  /** The collection, e.g. `volumes`. Only its published documents count. */
  slug: CollectionSlug
  /** Its `hasMany` relationship to the articles. */
  field: string
}

export interface ReadingHistoryPluginConfig extends SitePluginOptions {
  /** The collection readers are in. Default `users`. */
  usersSlug?: CollectionSlug
  /** The collection that's read. Default `articles`. Only its published documents count. */
  articlesSlug?: CollectionSlug
  /** Groups of articles a reader can finish, for the account page's totals. */
  groups?: ReadingGroups
  /**
   * Who is asking: a row of `usersSlug`, or null when nobody is signed in. Readers needn't be
   * Payload's `req.user`.
   */
  currentUser: (req: PayloadRequest) => Promise<ReadingUser | null>
  /** Who can see the reads in the admin. Default: nobody, which leaves the Local API. */
  readers?: Access
}

export type ResolvedReadingHistoryConfig = Required<
  Omit<ReadingHistoryPluginConfig, "enabled" | "groups">
> &
  Pick<ReadingHistoryPluginConfig, "groups"> & {
    enabled: (payload: PayloadRequest["payload"]) => Promise<boolean>
  }

/** What `GET /api/reading/mine` answers. */
export interface MyReading {
  articlesRead: number
  /** Null when the site has no groups of articles. */
  volumesRead: number | null
  daysVisited: number
  /** Days in a row, up to today or yesterday; 0 once it's broken. */
  currentStreak: number
  longestStreak: number
}
