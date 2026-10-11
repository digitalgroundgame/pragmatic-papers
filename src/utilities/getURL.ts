// SERVER_URL is read when the server runs, not compiled in like a NEXT_PUBLIC_ variable
// (which Next inlines into server code too), so one image can serve any host.
// Browser code never needs it: getClientURL reads the page's own origin there.

/** This deployment's public origin, from `SERVER_URL`, without a trailing slash. */
export const getSiteURL = (): string =>
  (process.env.SERVER_URL || "http://localhost:8000").replace(/\/+$/, "")

/**
 * The origin to build links with in code that runs in both places: the page's own origin in
 * the browser, `SERVER_URL` on the server (`""` without it, so links stay relative).
 */
export const getClientURL = (): string => {
  if (typeof window !== "undefined" && window.location) return window.location.origin
  return (process.env.SERVER_URL || "").replace(/\/+$/, "")
}

/**
 * Make a site path absolute, for anything read away from the site (feeds, emails,
 * structured data), which would resolve a relative URL against its own origin. Absolute
 * `http(s)` URLs pass through.
 */
export const absoluteURL = (url: string, base: string = getSiteURL()): string => {
  if (/^https?:\/\//.test(url)) return url
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`
}
