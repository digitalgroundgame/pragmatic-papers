import { SocialAdapter } from "@/blocks/SocialEmbed/adapters/base.adapter"
import { fetchOEmbed } from "@/blocks/SocialEmbed/helpers/fetchOEmbed"
import type { OEmbedRequestQuery, OEmbedRich } from "@/blocks/SocialEmbed/helpers/oEmbed"
import type { Prettify } from "@/utilities/prettify"
import { failure, type Result } from "@/utilities/results"
import sanitizeHtml from "sanitize-html"

export type BlueskyOEmbedOptions = OEmbedRequestQuery

export type BlueskyOEmbedResponse = Prettify<OEmbedRich & { url: string }>

/**
 * Bluesky adapter extending SocialAdapter with Bluesky-specific options and response types.
 */
class BlueskyAdapter extends SocialAdapter<BlueskyOEmbedOptions, BlueskyOEmbedResponse> {
  readonly maxWidth = 550
  readonly displayName = "Bluesky"

  isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      if (urlObj.hostname !== "bsky.app") return false
      // Supported pattern: /profile/*/post/*
      return urlObj.pathname.startsWith("/profile/") && urlObj.pathname.includes("/post/")
    } catch {
      return false
    }
  }

  buildUrl(options: BlueskyOEmbedOptions): URL {
    const { url, maxwidth = this.maxWidth } = options
    const endpoint = new URL("https://embed.bsky.app/oembed")
    endpoint.searchParams.set("url", url)
    endpoint.searchParams.set("format", "json")
    endpoint.searchParams.set("maxwidth", String(maxwidth))
    return endpoint
  }

  async getOEmbed(
    options: BlueskyOEmbedOptions,
    init?: RequestInit,
  ): Promise<Result<BlueskyOEmbedResponse, Error>> {
    if (!this.isValidUrl(options.url)) return failure(new Error("Invalid Bluesky post URL."))
    return await fetchOEmbed<BlueskyOEmbedResponse>(this.buildUrl(options), init)
  }

  async sanitize(html: string): Promise<string> {
    return sanitizeHtml(html, {
      allowedTags: ["blockquote", "p", "a"],
      allowedAttributes: {
        blockquote: [
          "class",
          "data-bluesky-uri",
          "data-bluesky-cid",
          "data-bluesky-embed-color-mode",
        ],
        p: ["lang"],
        a: ["href"],
      },
      allowedSchemes: ["http", "https"],
      // Allow data URIs on blockquote for Bluesky embeds
      allowProtocolRelative: false,
    })
  }
}

export const blueskyAdapter = new BlueskyAdapter()

export function fetchBlueskyOEmbed(
  options: BlueskyOEmbedOptions,
  init?: RequestInit,
): Promise<Result<BlueskyOEmbedResponse, Error>> {
  return blueskyAdapter.getOEmbed(options, init)
}

export function sanitizeBlueskyHtml(html: string): Promise<string> {
  return blueskyAdapter.sanitize(html)
}

export const BLUESKY_DISPLAY_NAME = blueskyAdapter.displayName
