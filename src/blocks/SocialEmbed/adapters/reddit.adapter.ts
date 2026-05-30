import { SocialAdapter } from "@/blocks/SocialEmbed/adapters/base.adapter"
import { fetchOEmbed } from "@/blocks/SocialEmbed/helpers/fetchOEmbed"
import type {
  OEmbedRequestQuery,
  OEmbedRich,
  OEmbedThumbnail,
} from "@/blocks/SocialEmbed/helpers/oEmbed"
import type { Prettify } from "@/utilities/prettify"
import { failure, type Result } from "@/utilities/results"
import sanitizeHtml from "sanitize-html"

export interface RedditOEmbedOptions extends OEmbedRequestQuery {
  parent?: boolean
  live?: boolean
  omitscript?: boolean
}

export type RedditOEmbedResponse = Prettify<OEmbedRich & Partial<OEmbedThumbnail>>

class RedditAdapter extends SocialAdapter<RedditOEmbedOptions, RedditOEmbedResponse> {
  readonly maxWidth = 550
  readonly displayName = "Reddit"

  isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      const host = urlObj.hostname.toLowerCase()
      const isRedditHost =
        host === "reddit.com" ||
        host === "www.reddit.com" ||
        host === "old.reddit.com" ||
        host === "np.reddit.com" ||
        host === "new.reddit.com" ||
        host === "amp.reddit.com"
      if (!isRedditHost) return false

      const path = urlObj.pathname
      const isPostOrComment = /^\/r\/[^/]+\/comments\/[^/]+(?:\/.*)?$/.test(path)
      const isCommunity = /^\/r\/[^/]+\/?$/.test(path)
      return isPostOrComment || isCommunity
    } catch {
      return false
    }
  }

  buildUrl(options: RedditOEmbedOptions): URL {
    const {
      url,
      maxwidth = this.maxWidth,
      parent = false,
      live = false,
      omitscript = true,
    } = options
    const endpoint = new URL("https://www.reddit.com/oembed")
    endpoint.searchParams.set("url", url)
    endpoint.searchParams.set("format", "json")
    endpoint.searchParams.set("maxwidth", String(maxwidth))
    endpoint.searchParams.set("parent", String(parent))
    endpoint.searchParams.set("live", String(live))
    endpoint.searchParams.set("omitscript", String(omitscript))
    return endpoint
  }

  async getOEmbed(
    options: RedditOEmbedOptions,
    init?: RequestInit,
  ): Promise<Result<RedditOEmbedResponse, Error>> {
    if (!this.isValidUrl(options.url)) return failure(new Error("Invalid Reddit URL."))
    return await fetchOEmbed<RedditOEmbedResponse>(this.buildUrl(options), init)
  }

  async sanitize(html: string): Promise<string> {
    return sanitizeHtml(html, {
      allowedTags: ["blockquote", "a", "br"],
      allowedAttributes: {
        blockquote: ["class", "cite", "style"],
        a: ["href"],
      },
      allowedSchemes: ["http", "https"],
      allowProtocolRelative: false,
    })
  }
}

export const redditAdapter = new RedditAdapter()

export function fetchRedditOEmbed(
  options: RedditOEmbedOptions,
  init?: RequestInit,
): Promise<Result<RedditOEmbedResponse, Error>> {
  return redditAdapter.getOEmbed(options, init)
}

export function sanitizeRedditHtml(html: string): Promise<string> {
  return redditAdapter.sanitize(html)
}

export const REDDIT_DISPLAY_NAME = redditAdapter.displayName
