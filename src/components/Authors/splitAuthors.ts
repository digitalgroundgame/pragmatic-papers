/** How many items an author list renders before it starts collapsing. */
export const MAX_AUTHOR_SLOTS = 3

export interface AuthorSplit<T> {
  /** The authors to render individually. */
  visible: T[]
  /** How many authors the overflow indicator stands for; `0` when none. */
  overflow: number
}

/**
 * Fit authors into at most `maxSlots` rendered items, counting the overflow
 * indicator ("+2", "2 more") as an item in its own right — so the byline and
 * the avatar stack stay the same width no matter how many authors there are.
 *
 * A list exactly `maxSlots` long still shows everyone: the indicator only
 * appears once it stands for more than one author, so it never displaces a
 * single name it had room to print.
 *
 *     maxSlots 3, 3 authors -> [A][B][C]
 *     maxSlots 3, 4 authors -> [A][B][+2]
 *     maxSlots 3, 9 authors -> [A][B][+7]
 */
export function splitAuthors<T>(authors: T[], maxSlots: number = MAX_AUTHOR_SLOTS): AuthorSplit<T> {
  if (authors.length <= maxSlots) return { visible: authors, overflow: 0 }

  const visible = authors.slice(0, Math.max(maxSlots - 1, 0))
  return { visible, overflow: authors.length - visible.length }
}
