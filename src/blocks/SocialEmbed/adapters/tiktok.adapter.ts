import { SocialAdapter } from "@/blocks/SocialEmbed/adapters/base.adapter"
import { fetchOEmbed } from "@/blocks/SocialEmbed/helpers/fetchOEmbed"
import type {
  OEmbedRequestQuery,
  OEmbedThumbnail,
  OEmbedVideo,
} from "@/blocks/SocialEmbed/helpers/oEmbed"
import type { Prettify } from "@/utilities/prettify"
import { failure, type Result } from "@/utilities/results"
import sanitizeHtml from "sanitize-html"

export function parseTikTokPostId(input: string): string | null {
  if (!URL.canParse(input)) return null
  const url = new URL(input)
  const host = url.hostname.toLowerCase()
  const isTikTokHost = host === "tiktok.com" || host === "www.tiktok.com" || host === "m.tiktok.com"
  if (!isTikTokHost) return null
  return url.pathname.match(/\/video\/(\d+)/)?.[1] ?? null
}

export interface TikTokIFrameSettings {
  controls?: 0 | 1
  progress_bar?: 0 | 1
  play_button?: 0 | 1
  volume_control?: 0 | 1
  fullscreen_button?: 0 | 1
  timestamp?: 0 | 1
  loop?: 0 | 1
  autoplay?: 0 | 1
  music_info?: 0 | 1
  description?: 0 | 1
  rel?: 0 | 1
  native_context_menu?: 0 | 1
  closed_caption?: 0 | 1
}

export function buildTikTokSrc(postId: string, settings: TikTokIFrameSettings = {}): string {
  const {
    controls = 1,
    progress_bar = 1,
    play_button = 1,
    volume_control = 1,
    fullscreen_button = 1,
    timestamp = 1,
    loop = 0,
    autoplay = 0,
    music_info = 0,
    description = 0,
    rel = 1,
    native_context_menu = 1,
    closed_caption = 1,
  } = settings
  const src = new URL(`https://www.tiktok.com/player/v1/${postId}`)
  src.searchParams.set("controls", String(controls))
  src.searchParams.set("progress_bar", String(progress_bar))
  src.searchParams.set("play_button", String(play_button))
  src.searchParams.set("volume_control", String(volume_control))
  src.searchParams.set("fullscreen_button", String(fullscreen_button))
  src.searchParams.set("timestamp", String(timestamp))
  src.searchParams.set("loop", String(loop))
  src.searchParams.set("autoplay", String(autoplay))
  src.searchParams.set("music_info", String(music_info))
  src.searchParams.set("description", String(description))
  src.searchParams.set("rel", String(rel))
  src.searchParams.set("native_context_menu", String(native_context_menu))
  src.searchParams.set("closed_caption", String(closed_caption))
  return src.toString()
}

/**
 * Patch the TikTok URL to the correct hostname.
 * TikTok's oEmbed endpoint requires `www.tiktok.com` rather than `tiktok.com`.
 */
function patchTikTokUrl(url: string): string {
  const urlNext = new URL(url)
  if (urlNext.hostname === "tiktok.com") {
    urlNext.hostname = "www.tiktok.com"
  }
  return urlNext.toString()
}

export type TikTokOEmbedOptions = OEmbedRequestQuery

export type TikTokOEmbedResponse = Prettify<OEmbedVideo & OEmbedThumbnail>

class TikTokAdapter extends SocialAdapter<TikTokOEmbedOptions, TikTokOEmbedResponse> {
  readonly maxWidth = 360
  readonly displayName = "TikTok"

  isValidUrl(url: string): boolean {
    return parseTikTokPostId(url) !== null
  }

  buildUrl(options: TikTokOEmbedOptions): URL {
    const endpoint = new URL("https://www.tiktok.com/oembed")
    endpoint.searchParams.set("url", patchTikTokUrl(options.url))
    return endpoint
  }

  async getOEmbed(
    options: TikTokOEmbedOptions,
    init?: RequestInit,
  ): Promise<Result<TikTokOEmbedResponse, Error>> {
    if (!this.isValidUrl(options.url)) return failure(new Error("Invalid TikTok post URL."))
    return await fetchOEmbed<TikTokOEmbedResponse>(this.buildUrl(options), init)
  }

  async sanitize(html: string): Promise<string> {
    return sanitizeHtml(html, {
      allowedTags: ["blockquote", "section", "p", "a"],
      allowedAttributes: {
        blockquote: ["class", "cite", "data-video-id", "data-embed-from", "style"],
        section: [],
        p: [],
        a: ["target", "title", "href"],
      },
      allowedSchemes: ["http", "https"],
      allowProtocolRelative: false,
    })
  }
}

export const tiktokAdapter = new TikTokAdapter()

export function fetchTikTokOEmbed(
  options: TikTokOEmbedOptions,
  init?: RequestInit,
): Promise<Result<TikTokOEmbedResponse, Error>> {
  return tiktokAdapter.getOEmbed(options, init)
}

export function sanitizeTikTokHtml(html: string): Promise<string> {
  return tiktokAdapter.sanitize(html)
}

export const TIKTOK_DISPLAY_NAME = tiktokAdapter.displayName
