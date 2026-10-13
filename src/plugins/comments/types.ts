import type { Access, CollectionSlug, Payload } from "payload"

/** A sign-in provider Better Auth has built in. */
export type ReaderProviderId = "google" | "discord"

/** An OAuth application's credentials, from the provider's developer console. */
export interface ReaderProviderCredentials {
  clientId: string
  clientSecret: string
}

export interface CommentsPluginConfig {
  /**
   * Leaves the schema in place (both collections, and the tables `commentsAfterSchemaInit`
   * adds) but registers no endpoint, so readers can neither sign in nor read or post.
   */
  disabled?: boolean
  /**
   * Whether comments are switched on right now. Asked on every request, so a feature flag
   * takes effect without a restart. Off: every endpoint answers 404.
   */
  enabled?: (args: { payload: Payload }) => boolean | Promise<boolean>
  /** The collection readers comment on. Default `articles`. */
  targetSlug?: CollectionSlug
  /** The providers readers sign in with, each with its credentials, or null while unset. */
  providers: () => Partial<Record<ReaderProviderId, ReaderProviderCredentials | null>>
  /** The site's public origin, which the providers redirect back to. */
  baseURL: () => string
  /** Signs the reader's session cookie and encrypts stored provider tokens. */
  secret: () => string
  /** Who can see, hide and delete comments and readers in the admin. */
  moderators: Access
  /** The admin sidebar group both collections sit in. Default `Content`. */
  adminGroup?: string
  /**
   * The reader's session cookie. Default `pp-reader`. Keep `payload-token` out of it: the
   * cache rules skip the edge for any cookie with that in its name, and a reader should get
   * the same cached page as everyone else.
   */
  cookieName?: string
  /** How long a reader stays signed in, in seconds. Default 30 days. */
  sessionSeconds?: number
  /** The longest comment, in characters. Default 2000. */
  maxLength?: number
  /** How long a reader waits between two comments, in seconds. Default 20. */
  cooldownSeconds?: number
}

export type ResolvedCommentsConfig = Required<Omit<CommentsPluginConfig, "disabled">>

/** What anyone can read about a comment. */
export interface PublicComment {
  id: number | string
  body: string
  createdAt: string
  author: { name: string; image: string | null }
}

/** The signed-in reader, as the thread endpoint describes them to themselves. */
export interface CommentViewer {
  name: string
  image: string | null
  /** A moderator stopped them from posting. */
  banned: boolean
}

/** `GET /api/comments/thread/:id`. */
export interface CommentThread {
  comments: PublicComment[]
  viewer: CommentViewer | null
  /** The providers a reader can sign in with here. */
  providers: ReaderProviderId[]
  maxLength: number
}
