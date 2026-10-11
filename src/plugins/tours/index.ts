import type { Plugin } from "payload"

export { findTour, TOUR_PARAM, TOURS, tourHref } from "./registry"
export type { Tour, TourStep } from "./types"

/**
 * Guided tours of the admin: driver.js popovers that walk staff through a feature, page by page.
 * A tour is code (`registry.ts`), shipped with the release that changes the screens it points
 * at, and started by a link from `tourHref`: a notification's Show me, or a help doc's.
 */
export const toursPlugin = (): Plugin => (config) => ({
  ...config,
  admin: {
    ...config.admin,
    components: {
      ...config.admin?.components,
      providers: [
        ...(config.admin?.components?.providers ?? []),
        "@/plugins/tours/TourProvider#TourProvider",
      ],
    },
  },
})
