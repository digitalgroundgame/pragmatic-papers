import type { User } from "@/payload-types"

/**
 * Join names into prose: `Ada and Grace`, `Ada, Grace and Radia`. `oxfordComma` puts a comma
 * before the conjunction when there are three or more.
 */
export function formatList(
  items: string[],
  {
    conjunction = "and",
    oxfordComma = false,
  }: { conjunction?: string; oxfordComma?: boolean } = {},
): string {
  if (!items.length) return ""
  if (items.length === 1) return items[0] ?? ""
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`
  const last = items[items.length - 1]
  return `${items.slice(0, -1).join(", ")}${oxfordComma ? "," : ""} ${conjunction} ${last}`
}

/**
 * Formats an array of authors from Articles into a prettified string.
 * @param authors - The authors array from an Article.
 * @returns A prettified string of authors.
 * @example
 *
 * [Author1, Author2] becomes 'Author1 and Author2'
 * [Author1, Author2, Author3] becomes 'Author1, Author2, and Author3'
 *
 */
export const formatAuthors = (authors: User[]): string => {
  // Ensure we don't have any authors without a name
  const authorNames = authors.map((author) => author.name).filter(Boolean) as string[]
  return formatList(authorNames)
}
