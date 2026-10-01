/**
 * Helpers for the HTML the feeds (RSS, the Substack import feed) and the block
 * converters behind them build by hand. Browser-safe: Storybook renders the
 * converters' output, so nothing here may import server-only code.
 */

/**
 * Make a site path absolute: feed readers and Substack resolve relative URLs
 * against their own origin, not ours. Absolute `http(s)` URLs pass through.
 */
export const absoluteURL = (url: string, siteUrl: string): string => {
  if (/^https?:\/\//.test(url)) return url
  return `${siteUrl}${url.startsWith("/") ? "" : "/"}${url}`
}
