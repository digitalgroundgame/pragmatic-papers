import { articlesTour } from "./articles"
import type { Tour } from "./types"

/** Every tour, by key. A tour ships with the release that changes the screens it points at. */
export const TOURS: Record<string, Tour> = Object.fromEntries(
  [articlesTour].map((tour) => [tour.key, tour]),
)

/** The search parameter that starts a tour on any admin page. */
export const TOUR_PARAM = "tour"

export const findTour = (key: string | null | undefined): Tour | undefined =>
  key ? TOURS[key] : undefined

/** A link that opens the admin and starts the tour, from the bell, a doc, or anywhere else. */
export const tourHref = (key: string): string => `/admin?${TOUR_PARAM}=${encodeURIComponent(key)}`
