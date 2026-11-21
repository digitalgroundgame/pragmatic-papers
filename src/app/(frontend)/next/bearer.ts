import { createHash, timingSafeEqual } from "node:crypto"

/** Whether a request carries `Authorization: Bearer <secret>`. False when `secret` is unset. */
export function hasBearer(request: Request, secret: string | undefined): boolean {
  const header = request.headers.get("authorization")
  if (!secret || !header?.startsWith("Bearer ")) return false
  // Hashing first gives both sides the same length, which timingSafeEqual requires.
  const digest = (value: string) => createHash("sha256").update(value).digest()
  return timingSafeEqual(digest(header.slice("Bearer ".length)), digest(secret))
}

/**
 * Whether a request carries `Authorization: Bearer <PAYLOAD_SECRET>`, for the `/next/*`
 * routes that CI and the other deployment call. False when PAYLOAD_SECRET is unset.
 */
export function hasPayloadSecret(request: Request): boolean {
  return hasBearer(request, process.env.PAYLOAD_SECRET)
}
