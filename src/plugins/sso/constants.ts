import type { SsoProviderId } from "./types"

export const DEFAULT_COOKIE_NAME = "payload-token-sso"

/** Where Better Auth's endpoints are mounted, under Payload's API route. */
export const AUTH_ENDPOINT_PATH = "/auth"

/** Better Auth's own tables. Each model's fields map to snake_case columns in `auth.ts`. */
export const TABLES = {
  session: "auth_sessions",
  account: "auth_accounts",
  verification: "auth_verifications",
} as const

export const PROVIDER_LABELS: Record<SsoProviderId, string> = {
  google: "Google",
  discord: "Discord",
}

/**
 * Better Auth endpoints that would write to the users table behind Payload's back, or that
 * belong to sign-in methods this site doesn't offer. Payload stays the only way to create,
 * edit or delete a user.
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
