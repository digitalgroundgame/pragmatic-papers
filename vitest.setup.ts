// Add global test setup here (e.g. @testing-library/jest-dom matchers)

// Load .env files
import "dotenv/config"

// jsdom implements none of the layout/viewport observation APIs, but
// embla-carousel (and anything else that measures the viewport) reaches for
// them on mount. Stub inert versions — they never fire, which is all a
// markup-level assertion needs.
const noop = (): void => undefined

if (typeof window !== "undefined") {
  class NoopObserver {
    observe = noop
    unobserve = noop
    disconnect = noop
    takeRecords = () => []
  }

  window.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver
  window.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver

  window.matchMedia ??= (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: noop,
      removeListener: noop,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}
