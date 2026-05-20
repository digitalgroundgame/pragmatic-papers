import { getServerSideURL } from "./getURL"

export interface GetMediaUrlOptions {
  cacheTag?: string | null
  absolute?: boolean
  encode?: boolean
}

export const getMediaUrl = (
  url: string | null | undefined,
  optionsOrCacheTag?: GetMediaUrlOptions | string | null,
): string => {
  if (!url) return ""

  let cacheTag: string | null = null
  let absolute = false
  let encode = false

  if (typeof optionsOrCacheTag === "string") {
    cacheTag = optionsOrCacheTag
  } else if (optionsOrCacheTag && typeof optionsOrCacheTag === "object") {
    cacheTag = optionsOrCacheTag.cacheTag ?? null
    absolute = optionsOrCacheTag.absolute ?? false
    encode = optionsOrCacheTag.encode ?? absolute
  }

  let formattedUrl = url

  // Prepend site URL if absolute path is requested and path is relative
  if (absolute && !url.startsWith("http://") && !url.startsWith("https://")) {
    const siteUrl = getServerSideURL()
    const needsSlash = !siteUrl.endsWith("/") && !url.startsWith("/")
    const duplicateSlash = siteUrl.endsWith("/") && url.startsWith("/")

    if (duplicateSlash) {
      formattedUrl = `${siteUrl}${url.slice(1)}`
    } else if (needsSlash) {
      formattedUrl = `${siteUrl}/${url}`
    } else {
      formattedUrl = `${siteUrl}${url}`
    }
  }

  // Appending cache tag to absolute URLs (matching original behavior)
  if (cacheTag && (formattedUrl.startsWith("http://") || formattedUrl.startsWith("https://"))) {
    const separator = formattedUrl.includes("?") ? "&" : "?"
    formattedUrl = `${formattedUrl}${separator}${cacheTag}`
  }

  if (encode) {
    try {
      return encodeURI(formattedUrl)
    } catch {
      return formattedUrl
    }
  }

  return formattedUrl
}
