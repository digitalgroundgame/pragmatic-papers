import type { Tour, TourStep } from "./types"

/** Where a tour is, kept in sessionStorage so it carries on after a page change. */
export interface TourProgress {
  key: string
  step: number
}

export const PROGRESS_KEY = "pp:tour"

const trimSlash = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, "") : path)

/** Whether `pathname` is the page `pattern` names; a `:param` segment matches any one segment. */
export const matchesPath = (pattern: string, pathname: string): boolean => {
  const want = trimSlash(pattern).split("/")
  const have = trimSlash(pathname).split("/")
  return (
    want.length === have.length &&
    want.every((segment, i) => segment.startsWith(":") || segment === have[i])
  )
}

/** A path the tour can open by itself: one with no `:param` segment. */
export const isOpenable = (pattern: string): boolean =>
  !trimSlash(pattern)
    .split("/")
    .some((segment) => segment.startsWith(":"))

/**
 * Steps that share the previous step's page, so Previous can go back without leaving it.
 * Going back a page isn't offered: a `:param` page can't be reopened.
 */
export const canGoBack = (tour: Tour, index: number): boolean => {
  const previous = tour.steps[index - 1]
  const step = tour.steps[index]
  return Boolean(previous && step && previous.path === step.path)
}

/**
 * What to do to show `step` from `pathname`: show it here, open its page first, or give up
 * (its page can't be opened directly and the reader isn't on it).
 */
export const placeStep = (
  step: TourStep,
  pathname: string,
): { action: "show" } | { action: "open"; path: string } | { action: "end" } => {
  if (matchesPath(step.path, pathname)) return { action: "show" }
  if (isOpenable(step.path)) return { action: "open", path: step.path }
  return { action: "end" }
}

/** Stored progress, or none when it's missing, malformed, or names a step the tour doesn't have. */
export const parseProgress = (
  raw: string | null,
  tours: Record<string, Tour>,
): TourProgress | null => {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<TourProgress>
    const tour = typeof value.key === "string" ? tours[value.key] : undefined
    if (!tour || typeof value.step !== "number" || !tour.steps[value.step]) return null
    return { key: tour.key, step: value.step }
  } catch {
    return null
  }
}
