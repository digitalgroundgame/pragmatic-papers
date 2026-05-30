export const getMediaUrl = (url: string | null | undefined, cacheTag?: string | null): string => {
  if (!url) return ""

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return cacheTag ? `${url}?${cacheTag}` : url
  }

  // Relative paths are served locally via next/image's internal route — no upstream
  // HTTP fetch, no private-IP SSRF block, and no query string needed (next/image has
  // its own TTL cache so the cache tag isn't necessary for local files).
  return url
}
