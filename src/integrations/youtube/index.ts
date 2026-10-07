import { env, type Integration } from "../types"

/** A broadcast on the channel that readers can join now, or soon. */
export interface YouTubeBroadcast {
  videoId: string
  title: string
  url: string
  /** `live` is on air now; `upcoming` is scheduled (or a premiere) and hasn't started. */
  status: "live" | "upcoming"
  /** When an upcoming broadcast is due to start, as YouTube reports it (ISO 8601). */
  scheduledStart: string | null
}

export interface YouTubeChannelIntegration extends Integration {
  /**
   * The channel's broadcast that is live now, or else the soonest one scheduled to start
   * within `upcomingWithinHours` (default 24), or null when there is neither. Throws when the
   * connection is not configured or YouTube refuses the request, with YouTube's own error
   * message and never the key.
   */
  currentBroadcast(opts?: {
    upcomingWithinHours?: number
    fetchImpl?: typeof fetch
    signal?: AbortSignal
  }): Promise<YouTubeBroadcast | null>
}

export interface YouTubeChannelOptions {
  id: string
  label: string
  /** Environment variable holding the channel's ID (`UC…`, from its About page → Share). */
  channelEnv: string
  /**
   * Environment variable holding a YouTube Data API v3 key. A plain API key is enough: every
   * read here is of public data, so no OAuth and no access to the channel's account.
   */
  keyEnv: string
}

const API = "https://www.googleapis.com/youtube/v3"

/** How many of the channel's newest uploads to look through for a broadcast. */
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

/**
 * A connection to one YouTube channel, for knowing when it is live.
 *
 * It costs 2 units of the API's 10,000-a-day quota per call: one to list the channel's newest
 * uploads (a live or scheduled broadcast is one of them), one to read their broadcast status.
 * `search.list` with `eventType=live` answers in one request but costs 100 units, which would
 * spend the day's quota in a hundred checks.
 */
export function youtubeChannel({
  id,
  label,
  channelEnv,
  keyEnv,
}: YouTubeChannelOptions): YouTubeChannelIntegration {
  const channelId = (): string | null => env(channelEnv)
  return {
    id,
    label,
    service: "YouTube",
    describe: () => {
      const channel = channelId()
      return channel ? `youtube:channel/${channel}` : "youtube:(no channel configured)"
    },
    required: [channelEnv, keyEnv],
    async currentBroadcast({ upcomingWithinHours = 24, fetchImpl = fetch, signal } = {}) {
      const channel = channelId()
      const key = env(keyEnv)
      if (!channel || !key) {
        throw new Error(`YouTube needs ${[channelEnv, keyEnv].join(" and ")}`)
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

      // Every channel's uploads playlist is its ID with `UC` swapped for `UU`.
      const uploads = await get<PlaylistItems>("playlistItems", {
        part: "contentDetails",
        playlistId: `UU${channel.slice(2)}`,
        maxResults: String(RECENT),
      })
      const ids = (uploads.items ?? [])
        .map((item) => item.contentDetails?.videoId)
        .filter((videoId): videoId is string => Boolean(videoId))
      if (ids.length === 0) return null

      const videos = await get<Videos>("videos", {
        part: "snippet,liveStreamingDetails",
        id: ids.join(","),
      })

      const broadcasts: YouTubeBroadcast[] = (videos.items ?? []).flatMap((video) => {
        const status = video.snippet?.liveBroadcastContent
        if (!video.id || (status !== "live" && status !== "upcoming")) return []
        return [
          {
            videoId: video.id,
            title: video.snippet?.title?.trim() || "Live on YouTube",
            url: `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`,
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
