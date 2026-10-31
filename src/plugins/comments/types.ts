import type { Access, CollectionSlug, Payload, PayloadRequest } from "payload"

import type { PluginEnabled } from "@/utilities/registerPlugin"

import type { COMMENT_STATUSES, VIOLATION_SOURCES } from "./constants"

export type CommentStatus = (typeof COMMENT_STATUSES)[number]
export type ViolationSource = (typeof VIOLATION_SOURCES)[number]

/** A row of the authors collection, as Payload returns it. */
export type CommentAuthor = Record<string, unknown> & { id: number | string }

/** How an author shows beside their comments. */
export interface AuthorDisplay {
  name: string
  image: string | null
  /** A short label beside their name, like "Staff". */
  badge: string | null
}

/** A way to sign in, as the comment box offers it. */
export interface SignInProvider {
  id: string
  label: string
}

/** The admin's settings, from the plugin's global. */
export interface CommentSettings {
  /** How many levels of replies a new reply may sit below a top-level comment. */
  maxDepth: number
  /** Active violations that stop an author commenting. */
  violationThreshold: number
  /** How long a violation stays active, in days. */
  violationWindowDays: number
  /** The most links one comment may hold. */
  maxLinks: number
  /** Hold a comment its author already posted, word for word, in the past day. */
  blockDuplicates: boolean
  /** Only authors `isVerified` accepts may comment. */
  requireVerifiedEmail: boolean
}

/** What a check is handed about a comment about to be posted. */
export interface CommentCheckArgs {
  body: string
  author: CommentAuthor
  targetId: number | string
  settings: CommentSettings
  req: PayloadRequest
}

/** A check passes, or holds the comment back with a reason moderators see. */
export type CommentCheckResult = { ok: true } | { ok: false; reason: string }

/**
 * Runs on each comment before it's posted. One that fails holds the comment back from
 * everyone but its author, and counts against them.
 */
export type CommentCheck = (
  args: CommentCheckArgs,
) => CommentCheckResult | Promise<CommentCheckResult>

export interface CommentsPluginConfig {
  /**
   * Leaves the schema in place (both collections and the settings global) but registers no
   * endpoint, so nobody can read or post.
   */
  disabled?: boolean
  /**
   * Whether comments are switched on right now. Asked on every request, so a switch takes
   * effect without a restart. Off: every endpoint answers 404.
   */
  enabled?: PluginEnabled
  /** The collection comments are on. Default `articles`. */
  targetSlug?: CollectionSlug
  /** The collection commenters are in. Default `users`. */
  authorsSlug?: CollectionSlug
  /**
   * Who is asking: a row of `authorsSlug`, or null when nobody is signed in. Commenters needn't
   * be Payload's `req.user`; the site decides how it knows them.
   */
  currentUser: (req: PayloadRequest) => Promise<CommentAuthor | null>
  /** The author's fields `describeAuthor` reads. Default `["name"]`. */
  authorFields?: string[]
  /** How an author shows beside their comments. Default: their `name`, no picture or badge. */
  describeAuthor?: (author: CommentAuthor) => AuthorDisplay
  /**
   * A badge for each author who has one from outside the plugin (readers' achievements), by author ID,
   * asked once per request for every author shown. A badge `describeAuthor` gives (like
   * Staff) wins. Default none.
   */
  authorBadges?: (authors: CommentAuthor[], req: PayloadRequest) => Promise<Map<string, string>>
  /**
   * The ways to sign in that the comment box offers someone signed out, passed through as the
   * thread's `providers`. The site's own page starts the sign-in. Default none.
   */
  signInProviders?: () => SignInProvider[]
  /**
   * Whether an author's email address is verified, for the settings' `requireVerifiedEmail`.
   * Default: their `emailVerified` is true.
   */
  isVerified?: (author: CommentAuthor) => boolean
  /** The site's public origin. Posts from any other origin are refused. */
  baseURL: () => string
  /** Who can see, hide, restore and delete comments, and see and reverse violations. */
  moderators: Access
  /** Who can change the settings global. */
  admins: Access
  /** More checks, run after the built-in ones (links and duplicates). */
  checks?: CommentCheck[]
  /**
   * The admin sidebar group of each part. Defaults: comments in `Content`, beside what they're
   * on; violations and the settings global in `System`, beside the site's other rules.
   */
  adminGroups?: Partial<CommentsAdminGroups>
  /** The longest comment, in characters. Default 2000. */
  maxLength?: number
  /** How long an author waits between two comments, in seconds. Default 20. */
  cooldownSeconds?: number
}

/** Where each part of the plugin sits in the admin sidebar. */
export interface CommentsAdminGroups {
  comments: string
  violations: string
  settings: string
}

export type ResolvedCommentsConfig = Required<
  Omit<CommentsPluginConfig, "disabled" | "enabled" | "adminGroups">
> & {
  adminGroups: CommentsAdminGroups
  enabled: (args: { payload: Payload }) => Promise<boolean>
}

/** What anyone can read about a comment. */
export interface PublicComment {
  id: number | string
  /** The comment it replies to, or null for a top-level one. */
  parentId: number | string | null
  /** 0 for a top-level comment, 1 for a reply to one, and so on. */
  depth: number
  body: string
  createdAt: string
  author: AuthorDisplay | null
  /**
   * A comment that's gone (hidden, or its author deleted it or their account) but has replies
   * still showing: kept as a placeholder so they stay in place. It has no body or author.
   */
  removed?: true
  /** The viewer's own comment, held back by a check: nobody else sees it. */
  held?: true
}

/** The signed-in author, as the thread endpoint describes them to themselves. */
export interface CommentViewer extends AuthorDisplay {
  /** Why they can't comment right now, and until when (null: until a moderator lifts it). */
  locked: { until: string | null } | null
  /** Commenting needs a verified email address, and theirs isn't. */
  needsVerifiedEmail: boolean
}

/** `GET /api/comments/thread/:id`. */
export interface CommentThread {
  comments: PublicComment[]
  viewer: CommentViewer | null
  /** How to sign in, for a viewer who isn't. */
  providers: SignInProvider[]
  maxDepth: number
  maxLength: number
  /** Whether older comments were left out: a thread shows its newest `THREAD_LIMIT`. */
  truncated?: boolean
}
