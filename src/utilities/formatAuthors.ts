// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Article } from "@/payload-types"

export function arrayToPlaintText(list: string[], conjunction = "and"): string {
  if (!list.length) return ""
  if (list.length === 1) return list[0] ?? ""
  if (list.length === 2) return `${list[0]} ${conjunction} ${list[1]}`
  return `${list.slice(0, -1).join(", ")} ${conjunction} ${list[list.length - 1]}`
}

export function arrayStringToPlainText(list: string, sep = ",", conjunction = "and"): string {
  return arrayToPlaintText(list.split(sep), conjunction)
}

/**
 * Formats an array of populatedAuthors from Articles into a prettified string.
 * @param authors - The populatedAuthors array from an Article.
 * @returns A prettified string of authors.
 * @example
 *
 * [Author1, Author2] becomes 'Author1 and Author2'
 * [Author1, Author2, Author3] becomes 'Author1, Author2, and Author3'
 *
 */
export const formatAuthors = (
  authors: NonNullable<NonNullable<Article["populatedAuthors"]>[number]>[],
): string => {
  // Ensure we don't have any authors without a name
  const authorNames = authors.map((author) => author.name).filter(Boolean) as string[]
  return arrayToPlaintText(authorNames)
}
