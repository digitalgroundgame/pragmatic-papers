import { SocialAdapter } from "@/blocks/SocialEmbed/adapters/base.adapter"
import { fetchOEmbed } from "@/blocks/SocialEmbed/helpers/fetchOEmbed"
import type { OEmbedRequestQuery } from "@/blocks/SocialEmbed/helpers/oEmbed"
import { type OEmbedRich } from "@/blocks/SocialEmbed/helpers/oEmbed"
import type { Prettify } from "@/utilities/prettify"
import { failure, type Result } from "@/utilities/results"
import sanitizeHtml from "sanitize-html"

/**
 * https://developer.x.com/en/docs/x-for-websites/oembed-api
 */
export type TwitterOEmbedLang =
  | "en"
  | "ar"
  | "bn"
  | "cs"
  | "da"
  | "de"
  | "el"
  | "es"
  | "fa"
  | "fi"
  | "fil"
  | "fr"
  | "he"
  | "hi"
  | "hu"
  | "id"
  | "it"
  | "ja"
  | "ko"
  | "msa"
  | "nl"
  | "no"
  | "pl"
  | "pt"
  | "ro"
  | "ru"
  | "sv"
  | "th"
  | "tr"
  | "uk"
  | "ur"
  | "vi"
  | "zh-cn"
  | "zh-tw"

/**
 * Twitter/X oEmbed request options.
 * Extends the base with Twitter-specific parameters.
 */
export interface TwitterOEmbedOptions extends OEmbedRequestQuery {
  hideMedia?: boolean | null
  hideThread?: boolean | null
  omitScript?: boolean
  align?: "left" | "right" | "center" | "none"
  lang?: TwitterOEmbedLang
  theme?: "light" | "dark"
  dnt?: boolean
}

export type TwitterOEmbedResponse = Prettify<OEmbedRich & { url: string }>

/**
 * Twitter adapter extending SocialAdapter with Twitter/X-specific options and response types.
 */
class TwitterAdapter extends SocialAdapter<TwitterOEmbedOptions, TwitterOEmbedResponse> {
  readonly maxWidth = 550
  readonly displayName = "Twitter"

  isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      const host = urlObj.hostname.toLowerCase()
      if (host !== "twitter.com" && host !== "x.com") return false
      // Supported pattern: /username/status/123456789
      const statusMatch = /^\/\w+\/status\/\d+/.test(urlObj.pathname)
      return statusMatch
    } catch {
      return false
    }
  }

  /**
   * Builds the Twitter oEmbed endpoint URL with query parameters from options.
   */
  buildUrl(options: TwitterOEmbedOptions): URL {
    const {
      url,
      maxwidth = this.maxWidth,
      hideMedia = false,
      hideThread = true,
      omitScript = true,
      align = "none",
      lang = "en",
      theme = "light",
      dnt = true,
    } = options

    const endpoint = new URL("https://publish.twitter.com/oembed")
    endpoint.searchParams.set("url", url)
    endpoint.searchParams.set("maxwidth", String(maxwidth))
    endpoint.searchParams.set("hide_media", String(hideMedia))
    endpoint.searchParams.set("hide_thread", String(hideThread))
    endpoint.searchParams.set("omit_script", String(omitScript))
    endpoint.searchParams.set("align", align)
    endpoint.searchParams.set("lang", lang)
    endpoint.searchParams.set("theme", theme)
    endpoint.searchParams.set("dnt", String(dnt))

    return endpoint
  }

  async getOEmbed(
    options: TwitterOEmbedOptions,
    init?: RequestInit,
  ): Promise<Result<TwitterOEmbedResponse, Error>> {
    const { url } = options
    if (!this.isValidUrl(url)) return failure(new Error("Invalid Twitter/X post URL."))
    return await fetchOEmbed<TwitterOEmbedResponse>(this.buildUrl(options), init)
  }

  async sanitize(html: string): Promise<string> {
    return sanitizeHtml(html, {
      allowedTags: ["blockquote", "p", "a"],
      allowedAttributes: {
        blockquote: ["class", "data-dnt", "data-theme", "data-lang", "data-width"],
        p: ["lang", "dir"],
        a: ["href"],
      },
      allowedSchemes: ["http", "https"],
      allowProtocolRelative: false,
    })
  }
}

export const twitterAdapter = new TwitterAdapter()

export function fetchTwitterOEmbed(
  options: TwitterOEmbedOptions,
  init?: RequestInit,
): Promise<Result<TwitterOEmbedResponse, Error>> {
  return twitterAdapter.getOEmbed(options, init)
}

export function sanitizeTwitterHtml(html: string): Promise<string> {
  return twitterAdapter.sanitize(html)
}

export const TWITTER_DISPLAY_NAME = twitterAdapter.displayName
