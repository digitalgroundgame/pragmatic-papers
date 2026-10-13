import type { ReaderProviderId } from "./types"

export const DEFAULT_COOKIE_NAME = "pp-reader"

export const COMMENTS_SLUG = "comments"
export const READERS_SLUG = "readers"

/** Where Better Auth's endpoints for readers are mounted, under Payload's API route. */
export const READER_AUTH_PATH = "/reader-auth"

/** Better Auth's own tables for readers, apart from the staff sign-in's `auth_*` ones. */
export const TABLES = {
  session: "reader_sessions",
  account: "reader_accounts",
  verification: "reader_verifications",
} as const

export const PROVIDER_LABELS: Record<ReaderProviderId, string> = {
  google: "Google",
  discord: "Discord",
}

/**
 * Better Auth endpoints for sign-in methods this site doesn't offer readers, or that would
 * change a reader's record (their name shows beside their comments, so a moderator who
 * looked at it once can trust it). Readers sign in with a provider, and that's all.
 */
export const DISABLED_PATHS = [
  "/sign-up/email",
  "/sign-in/email",
  "/update-user",
  "/change-email",
  "/change-password",
  "/set-password",
  "/reset-password",
  "/request-password-reset",
  "/delete-user",
  "/send-verification-email",
  "/verify-email",
]
