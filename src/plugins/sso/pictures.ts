import type { PostgresAdapter } from "@payloadcms/db-postgres"

type Pool = PostgresAdapter["pool"]

/** How long a picture waits for the account row it belongs to. */
const PENDING_MS = 60_000

/**
 * Pictures a provider sent with a link, until the account is written. Better Auth shows us the
 * provider's profile (`validateUserInfo`) before it creates the account, and may still refuse
 * the link after that (an account linked to someone else), while the account hook after it
 * doesn't see the profile. So the picture waits here, keyed by user and provider.
 */
const pending = new Map<string, { image: string; expires: number }>()

const key = (userId: string | number, providerId: string) => `${userId}:${providerId}`

/** Only an https URL is kept: it's rendered as an image in the admin. */
export function pictureURL(image: unknown): string | null {
  if (typeof image !== "string" || image === "") return null
  try {
    return new URL(image).protocol === "https:" ? image : null
  } catch {
    return null
  }
}

/** Holds the picture a provider just sent for this user, if it sent one. */
export function rememberPicture(userId: string | number, providerId: string, image: unknown): void {
  const now = Date.now()
  for (const [k, entry] of pending) if (entry.expires < now) pending.delete(k)
  const url = pictureURL(image)
  if (url) pending.set(key(userId, providerId), { image: url, expires: now + PENDING_MS })
}

/** The picture held for this user and provider, once; null when none is held. */
export function takePicture(userId: string | number, providerId: string): string | null {
  const k = key(userId, providerId)
  const entry = pending.get(k)
  pending.delete(k)
  if (!entry || entry.expires < Date.now()) return null
  return entry.image
}

/**
 * Saves a held picture to the user an account was just linked to (Better Auth's `image`, the
 * users table's `avatar_url`), when they have no picture yet: neither a saved one nor one of
 * their own (`hasPicture`, the host's profile image). The first linked account with a picture
 * wins, and it stays when that account is disconnected.
 */
export async function savePicture(
  pool: Pool,
  usersTable: string,
  account: { userId?: unknown; providerId?: unknown },
  hasPicture: (userId: string) => Promise<boolean>,
): Promise<void> {
  if (account.userId == null || typeof account.providerId !== "string") return
  const userId = String(account.userId)
  const image = takePicture(userId, account.providerId)
  if (!image || (await hasPicture(userId))) return
  await pool.query(
    `update "${usersTable}" set avatar_url = $1 where id = $2 and avatar_url is null`,
    [image, Number(userId)],
  )
}
