/**
 * Narrows unknown input to a plain JSON object, which is what every hand-written validator
 * here needs before it can read a field off it.
 *
 * Arrays and `null` are objects to `typeof` and are both excluded: a validator that let one
 * through would go on to read named fields off a list, or off nothing.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
