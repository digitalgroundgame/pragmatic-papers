import type { Integration } from "../types"

/**
 * The connection alone, apart from the client in `./index`, so a test that mocks the client
 * still gets the declaration `INTEGRATIONS` lists.
 */
export const REQUIRED_ENV = [
  "LISTMONK_BASE_URL",
  "LISTMONK_API_USER",
  "LISTMONK_API_TOKEN",
  "LISTMONK_NEWSLETTER_LIST_ID",
  "LISTMONK_NEWSLETTER_LIST_UUID",
  "NEWSLETTER_FROM_EMAIL",
] as const

/** The Listmonk instance behind the newsletter: signups and the daily campaign queue. */
export const listmonkServer: Integration = {
  id: "listmonk",
  label: "Newsletter mailing list",
  service: "Listmonk",
  describe: () => `listmonk:${process.env.LISTMONK_BASE_URL || "(no server configured)"}`,
  required: REQUIRED_ENV,
}
