/**
 * A query parameter's value. Next hands a parameter the URL repeats (`?q=a&q=b`) over as
 * an array; the first is the one a form would have sent.
 */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
