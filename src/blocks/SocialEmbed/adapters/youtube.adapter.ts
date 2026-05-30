import { SocialAdapter } from "@/blocks/SocialEmbed/adapters/base.adapter"
import { fetchOEmbed } from "@/blocks/SocialEmbed/helpers/fetchOEmbed"
import type { OEmbedRequestQuery, OEmbedVideo } from "@/blocks/SocialEmbed/helpers/oEmbed"
import type { Prettify } from "@/utilities/prettify"
import { failure, type Result } from "@/utilities/results"
import sanitizeHtml from "sanitize-html"

export type YouTubeOEmbedOptions = OEmbedRequestQuery

export type YouTubeOEmbedResponse = Prettify<OEmbedVideo>

/**
 * Extracts a YouTube video ID from common URL patterns.
 * Supports youtube.com/watch?v=, youtu.be/, youtube.com/embed/, youtube.com/v/
 */
export function parseYouTubeVideoId(input: string): string | null {
  if (!URL.canParse(input)) return null
  try {
    const url = new URL(input)
    const host = url.hostname.toLowerCase().replace(/^www\./, "")
    if (host === "youtube.com" || host === "youtu.be") {
      if (host === "youtu.be") {
        const id = url.pathname.slice(1).split("/")[0]
        return id && !id.includes("?") ? id : null
      }
      const v = url.searchParams.get("v")
      if (v) return v
      const embedMatch = url.pathname.match(/^\/embed\/([^/?#]+)/)
      if (embedMatch?.[1]) return embedMatch[1]
      const vMatch = url.pathname.match(/^\/v\/([^/?#]+)/)
      if (vMatch?.[1]) return vMatch[1]
    }
    return null
  } catch {
    return null
  }
}

class YouTubeAdapter extends SocialAdapter<YouTubeOEmbedOptions, YouTubeOEmbedResponse> {
  readonly maxWidth = 640
  readonly displayName = "YouTube"

  isValidUrl(url: string): boolean {
    return parseYouTubeVideoId(url) !== null
  }

  buildUrl(options: YouTubeOEmbedOptions): URL {
    const { url, maxwidth = this.maxWidth, maxheight } = options
    const endpoint = new URL("https://www.youtube.com/oembed")
    endpoint.searchParams.set("url", url)
    endpoint.searchParams.set("format", "json")
    endpoint.searchParams.set("maxwidth", String(maxwidth))
    if (maxheight != null) endpoint.searchParams.set("maxheight", String(maxheight))
    return endpoint
  }

  async getOEmbed(
    options: YouTubeOEmbedOptions,
    init?: RequestInit,
  ): Promise<Result<YouTubeOEmbedResponse, Error>> {
    if (!this.isValidUrl(options.url)) {
      return failure(new Error("Invalid YouTube URL."))
    }
    return await fetchOEmbed<YouTubeOEmbedResponse>(this.buildUrl(options), init)
  }

  async sanitize(html: string): Promise<string> {
    return sanitizeHtml(html, {
      allowedTags: ["iframe"],
      allowedAttributes: {
        iframe: [
          "src",
          "width",
          "height",
          "frameborder",
          "allow",
          "referrerpolicy",
          "allowfullscreen",
          "title",
        ],
      },
      allowedSchemes: ["http", "https"],
      allowProtocolRelative: false,
    })
  }
}

export const youtubeAdapter = new YouTubeAdapter()

export function fetchYouTubeOEmbed(
  options: YouTubeOEmbedOptions,
  init?: RequestInit,
): Promise<Result<YouTubeOEmbedResponse, Error>> {
  return youtubeAdapter.getOEmbed(options, init)
}

export function sanitizeYouTubeHtml(html: string): Promise<string> {
  return youtubeAdapter.sanitize(html)
}

export const YOUTUBE_DISPLAY_NAME = youtubeAdapter.displayName
