import { env, type Integration } from "../types"

/** A broadcast on one of the channels that readers can join now, or soon. */
export interface YouTubeBroadcast {
  videoId: string
  title: string
  url: string
  /** `live` is on air now; `upcoming` is scheduled (or a premiere) and hasn't started. */
  status: "live" | "upcoming"
  /** When an upcoming broadcast is due to start, as YouTube reports it (ISO 8601). */
  scheduledStart: string | null
}

export interface YouTubeChannelsIntegration extends Integration {
  /**
   * The channel IDs to watch: `channelIds` when it has any (the admin's list), else the
   * comma-separated channels variable.
   */
  channels(channelIds?: readonly string[] | null): string[]
  /**
   * A broadcast that is live now on any of the channels (the first channel listed wins when
   * several are), or else the soonest one scheduled to start within `upcomingWithinHours`
   * (default 24), or null when there is neither. Throws when the connection has no key or no
   * channel, or YouTube refuses a request, with YouTube's own error message and never the key.
   */
  currentBroadcast(opts?: {
    /** The channels to watch, as set in the admin; falls back to the channels variable. */
    channelIds?: readonly string[] | null
    upcomingWithinHours?: number
    fetchImpl?: typeof fetch
    signal?: AbortSignal
  }): Promise<YouTubeBroadcast | null>
}

export interface YouTubeChannelsOptions {
  id: string
  label: string
  /**
   * Environment variable holding channel IDs (`UC…`, from each About page → Share), comma
   * separated, for when the admin doesn't list any.
   */
  channelsEnv: string
  /**
   * Environment variable holding a YouTube Data API v3 key. A plain API key is enough: every
   * read here is of public data, so no OAuth and no access to the channels' accounts.
   */
  keyEnv: string
}

const API = "https://www.googleapis.com/youtube/v3"

/** How many of each channel's newest uploads to look through for a broadcast. */
const RECENT = 10

interface YouTubeError {
  error?: { code?: number; message?: string }
}

interface PlaylistItems {
  items?: { contentDetails?: { videoId?: string } }[]
}

interface Videos {
  items?: {
    id?: string
    snippet?: { title?: string; liveBroadcastContent?: string }
    liveStreamingDetails?: { scheduledStartTime?: string; actualStartTime?: string }
  }[]
}

const list = (ids: readonly string[]): string[] => [
  ...new Set(ids.map((id) => id.trim()).filter(Boolean)),
]

/**
 * A connection to our YouTube channels, for knowing when one of them is live.
 *
 * Each check costs one unit of the API's 10,000-a-day quota per channel, to list its newest
 * uploads (a live or scheduled broadcast is one of them), plus one to read all their broadcast
 * statuses at once. `search.list` with `eventType=live` answers in one request but costs 100
 * units a channel, which would spend the day's quota in a hundred checks.
 */
export function youtubeChannels({
  id,
  label,
  channelsEnv,
  keyEnv,
}: YouTubeChannelsOptions): YouTubeChannelsIntegration {
  const channels = (channelIds?: readonly string[] | null): string[] => {
    const chosen = list(channelIds ?? [])
    return chosen.length > 0 ? chosen : list((env(channelsEnv) ?? "").split(","))
  }
  return {
    id,
    label,
    service: "YouTube",
    describe: () => {
      const ids = channels()
      return ids.length > 0
        ? ids.map((channel) => `youtube:channel/${channel}`).join(", ")
        : "youtube:(channels set in the admin)"
    },
    // Channels aren't secrets, so the admin can list them instead; only the key must be here.
    required: [keyEnv],
    optional: [channelsEnv],
    channels,
    async currentBroadcast({
      channelIds,
      upcomingWithinHours = 24,
      fetchImpl = fetch,
      signal,
    } = {}) {
      const ids = channels(channelIds)
      const key = env(keyEnv)
      if (!key) throw new Error(`YouTube needs ${keyEnv}`)
      if (ids.length === 0) {
        throw new Error(`YouTube needs a channel: list one in the admin or set ${channelsEnv}`)
      }

      const get = async <T>(path: string, params: Record<string, string>): Promise<T> => {
        // The key goes in a header rather than the query string, so it never appears in a
        // logged URL.
        const response = await fetchImpl(`${API}/${path}?${new URLSearchParams(params)}`, {
          headers: { "X-Goog-Api-Key": key },
          signal,
        })
        const body = (await response.json().catch(() => ({}))) as T & YouTubeError
        if (!response.ok) {
          const reason = body.error?.message
          throw new Error(
            `YouTube ${path} failed (HTTP ${response.status})${reason ? `: ${reason}` : ""}`,
          )
        }
        return body
      }

      // Every channel's uploads playlist is its ID with `UC` swapped for `UU`. Channel order is
      // kept, so the first channel listed wins when two are live at once.
      const uploads = await Promise.all(
        ids.map((channel) =>
          get<PlaylistItems>("playlistItems", {
            part: "contentDetails",
            playlistId: `UU${channel.slice(2)}`,
            maxResults: String(RECENT),
          }),
        ),
      )
      const videoIds = uploads
        .flatMap((playlist) => playlist.items ?? [])
        .map((item) => item.contentDetails?.videoId)
        .filter((videoId): videoId is string => Boolean(videoId))
        // `videos.list` takes at most 50 IDs: five channels' worth.
        .slice(0, 50)
      if (videoIds.length === 0) return null

      const videos = await get<Videos>("videos", {
        part: "snippet,liveStreamingDetails",
        id: videoIds.join(","),
      })
      const byId = new Map((videos.items ?? []).map((video) => [video.id, video]))

      const broadcasts: YouTubeBroadcast[] = videoIds.flatMap((videoId) => {
        const video = byId.get(videoId)
        const status = video?.snippet?.liveBroadcastContent
        if (!video || (status !== "live" && status !== "upcoming")) return []
        return [
          {
            videoId,
            title: video.snippet?.title?.trim() || "Live on YouTube",
            url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
            status,
            scheduledStart: video.liveStreamingDetails?.scheduledStartTime ?? null,
          },
        ]
      })

      const live = broadcasts.find((b) => b.status === "live")
      if (live) return live

      // A stream scheduled weeks out sits in the uploads list as "upcoming" the whole time;
      // only one about to start is worth a reader's attention. One whose time has passed
      // without going live is left out too: it was most likely cancelled or moved.
      const now = Date.now()
      const horizon = now + upcomingWithinHours * 60 * 60 * 1000
      return (
        broadcasts
          .filter((b) => {
            const start = b.scheduledStart ? Date.parse(b.scheduledStart) : NaN
            return b.status === "upcoming" && start >= now && start <= horizon
          })
          .sort((a, b) => Date.parse(a.scheduledStart!) - Date.parse(b.scheduledStart!))[0] ?? null
      )
    },
  }
}
