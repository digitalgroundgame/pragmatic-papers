import type { Integration } from "../types"

/**
 * Cloudflare Turnstile siteverify client.
 *
 * Used to gate the newsletter signup form against bot-driven subscription
 * bombing. The client widget produces a token; we POST it (with the user's
 * IP) to siteverify, and Cloudflare returns whether the token is valid.
 *
 * Tokens are single-use and expire after ~300s. Server-side verification
 * is mandatory — the client widget alone is purely cosmetic.
 *
 * Required env vars:
 *   CLOUDFLARE_TURNSTILE_SECRET_KEY  server-side secret from the Turnstile dashboard
 *   TURNSTILE_SITE_KEY               public site key, read on the server and passed to
 *                                    the widget
 */

/** Turnstile, which the newsletter signup form checks before subscribing anyone. */
export const cloudflareTurnstile: Integration = {
  id: "cloudflare-turnstile",
  label: "Newsletter signup bot check",
  service: "Cloudflare",
  describe: () => "cloudflare:turnstile",
  required: ["CLOUDFLARE_TURNSTILE_SECRET_KEY", "TURNSTILE_SITE_KEY"],
}

/**
 * The public site key for the signup widget, or undefined to render the form without it.
 * Read when the server renders the block rather than compiled into the browser bundle,
 * so one build can run with a different key.
 */
export const getTurnstileSiteKey = (): string | undefined =>
  process.env.TURNSTILE_SITE_KEY || undefined

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

interface SiteverifyResponse {
  success: boolean
  "error-codes"?: string[]
}

export interface VerifyTurnstileInput {
  token: string
  /** Client IP from x-forwarded-for / x-real-ip. Optional but recommended. */
  ip?: string
}

export async function verifyTurnstileToken(input: VerifyTurnstileInput): Promise<boolean> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY
  if (!secret) throw new Error("Missing required env var: CLOUDFLARE_TURNSTILE_SECRET_KEY")
  if (!input.token) return false

  const form = new URLSearchParams()
  form.set("secret", secret)
  form.set("response", input.token)
  if (input.ip) form.set("remoteip", input.ip)

  const res = await fetch(SITEVERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`Turnstile siteverify → ${res.status}`)
  }
  const data = (await res.json()) as SiteverifyResponse
  if (!data.success) {
    console.warn("[turnstile] verification failed", data["error-codes"])
  }
  return data.success
}
