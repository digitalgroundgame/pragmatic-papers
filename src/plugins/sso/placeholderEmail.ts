/**
 * Every user needs an address, and Destiny.gg shares none, so a member who signs up with it
 * gets one made from their Destiny.gg id. `.invalid` is reserved (RFC 2606): no address in it
 * can receive mail, so nothing is ever sent to one, and no provider can vouch for one.
 */
export const PLACEHOLDER_EMAIL_DOMAIN = "no-email.invalid"

/** The placeholder for a provider account: unique, since the provider's id is. */
export function placeholderEmail(providerId: string, accountId: string | number): string {
  return `${providerId}-${accountId}@${PLACEHOLDER_EMAIL_DOMAIN}`.toLowerCase()
}

/** Whether an address is a placeholder rather than one someone gave us. */
export function isPlaceholderEmail(email: unknown): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)
}
