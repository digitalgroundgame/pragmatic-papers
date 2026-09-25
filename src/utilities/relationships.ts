/**
 * Payload relationship fields come back one of two ways depending on the `depth`
 * a query ran at: the full related document, or just its row id. Every call site
 * that reads fields off a relationship has to narrow first, so the narrowing
 * lives here instead of being hand-rolled per component.
 */
export type Relationship<T> = T | number | null | undefined

/**
 * Narrows a relationship to the resolved document.
 *
 * Returns `false` for both an unresolved id (the query ran at insufficient
 * depth — usually a bug) and a null/undefined relationship (nothing is set).
 * Where those two cases need different handling, check `typeof rel === "number"`
 * explicitly before calling this.
 */
export function isResolved<T extends object>(rel: Relationship<T>): rel is T {
  return typeof rel === "object" && rel !== null
}

/**
 * Extracts the row id from a relationship, resolved or not. Returns `null` when
 * the relationship is unset.
 */
export function relationshipId<T extends { id: number }>(rel: Relationship<T>): number | null {
  if (rel === null || rel === undefined) return null
  return isResolved(rel) ? rel.id : rel
}
