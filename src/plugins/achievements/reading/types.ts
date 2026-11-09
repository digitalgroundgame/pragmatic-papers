import type { Access, CollectionSlug, Payload, PayloadRequest } from "payload"

/** A row of the users collection, as Payload returns it. */
export type ReadingUser = Record<string, unknown> & { id: number | string }

/** Collections that group the articles: a volume is read once every article in it is. */
export interface ReadingGroups {
  /** The collection, e.g. `volumes`. Only its published documents count. */
  slug: CollectionSlug
  /** Its `hasMany` relationship to the articles. */
  field: string
}

/** What readers read and how often they visit: the achievements plugin's `reading` option. */
export interface ReadingOptions {
  /** The collection that's read. Default `articles`. Only its published documents count. */
  articlesSlug?: CollectionSlug
  /** Groups of articles a reader can finish, for the account page's totals. */
  groups?: ReadingGroups
}

/** The achievements plugin's options as reading uses them, with defaults filled in. */
export interface ResolvedReadingConfig {
  usersSlug: CollectionSlug
  articlesSlug: CollectionSlug
  groups?: ReadingGroups
  /** Who is asking: a row of `usersSlug`, or null when nobody is signed in. */
  currentUser: (req: PayloadRequest) => Promise<ReadingUser | null>
  /** Who can see the reads and visits in the admin. */
  readers: Access
  /** Off in code: the schema stays, nothing is recorded. */
  disabled: boolean
  /** Whether it records right now: the achievements switch. */
  enabled: (payload: Payload) => Promise<boolean>
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
