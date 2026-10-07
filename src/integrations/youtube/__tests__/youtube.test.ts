import { afterEach, describe, expect, it, vi } from "vitest"

import { integrationStatus } from "../../types"
import { youtubeChannels } from "../index"

const channel = youtubeChannels({
  id: "youtube-example",
  label: "Example channels",
  channelsEnv: "EXAMPLE_CHANNEL_IDS",
  keyEnv: "EXAMPLE_YOUTUBE_KEY",
})

const reply = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const NOW = Date.parse("2026-10-07T18:00:00Z")
const hoursFromNow = (hours: number): string => new Date(NOW + hours * 3_600_000).toISOString()

interface Video {
  id: string
  status: "live" | "upcoming" | "none"
  title?: string
  scheduledStart?: string
}

/** A fetch that answers the uploads list, then the videos' statuses. */
function youtube(videos: Video[]): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith("/playlistItems")) {
      return reply({ items: videos.map((v) => ({ contentDetails: { videoId: v.id } })) })
    }
    return reply({
      items: videos.map((v) => ({
        id: v.id,
        snippet: { title: v.title ?? v.id, liveBroadcastContent: v.status },
        liveStreamingDetails: v.scheduledStart
          ? { scheduledStartTime: v.scheduledStart }
          : undefined,
      })),
    })
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe("youtubeChannel", () => {
  it("needs only the key, since the admin can list the channels", () => {
    vi.stubEnv("EXAMPLE_CHANNEL_IDS", "")
    vi.stubEnv("EXAMPLE_YOUTUBE_KEY", "")
    expect(integrationStatus(channel)).toMatchObject({
      service: "YouTube",
      target: "youtube:(channels set in the admin)",
      configured: false,
      missing: ["EXAMPLE_YOUTUBE_KEY"],
      unset: ["EXAMPLE_CHANNEL_IDS"],
    })
  })

  describe("currentBroadcast", () => {
    const configure = (): void => {
      vi.stubEnv("EXAMPLE_CHANNEL_IDS", "UCabc123")
      vi.stubEnv("EXAMPLE_YOUTUBE_KEY", "secret-key")
      vi.useFakeTimers({ now: NOW, toFake: ["Date"] })
    }

    it("reads the channel's uploads playlist, with the key in a header and not the URL", async () => {
      configure()
      const fetchImpl = youtube([{ id: "vid1", status: "none" }])
      await channel.currentBroadcast({ fetchImpl })

      const [uploads, videos] = fetchImpl.mock.calls
      const uploadsUrl = new URL(String(uploads![0]))
      expect(uploadsUrl.searchParams.get("playlistId")).toBe("UUabc123")
      expect(new URL(String(videos![0])).searchParams.get("id")).toBe("vid1")
      for (const [url, init] of fetchImpl.mock.calls) {
        expect(String(url)).not.toContain("secret-key")
        expect(init?.headers).toEqual({ "X-Goog-Api-Key": "secret-key" })
      }
    })

    it("returns the broadcast that is live now", async () => {
      configure()
      const broadcast = await channel.currentBroadcast({
        fetchImpl: youtube([
          { id: "old", status: "none" },
          { id: "soon", status: "upcoming", scheduledStart: hoursFromNow(1) },
          { id: "onair", status: "live", title: " The Pragmatic Papers, live " },
        ]),
      })
      expect(broadcast).toEqual({
        videoId: "onair",
        title: "The Pragmatic Papers, live",
        url: "https://www.youtube.com/watch?v=onair",
        status: "live",
        scheduledStart: null,
      })
    })

    it("falls back to the soonest broadcast starting within the window", async () => {
      configure()
      const broadcast = await channel.currentBroadcast({
        fetchImpl: youtube([
          { id: "later", status: "upcoming", scheduledStart: hoursFromNow(5) },
          { id: "next", status: "upcoming", scheduledStart: hoursFromNow(2) },
          { id: "missed", status: "upcoming", scheduledStart: hoursFromNow(-1) },
          { id: "next-week", status: "upcoming", scheduledStart: hoursFromNow(24 * 7) },
        ]),
      })
      expect(broadcast).toMatchObject({ videoId: "next", status: "upcoming" })
    })

    it("returns null when nothing is live or about to be", async () => {
      configure()
      const fetchImpl = youtube([
        { id: "old", status: "none" },
        { id: "next-week", status: "upcoming", scheduledStart: hoursFromNow(24 * 7) },
      ])
      expect(await channel.currentBroadcast({ fetchImpl })).toBeNull()
    })

    it("skips the status read when the channel has no uploads", async () => {
      configure()
      const fetchImpl = youtube([])
      expect(await channel.currentBroadcast({ fetchImpl })).toBeNull()
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it("throws YouTube's own message, never the key", async () => {
      configure()
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        reply(
          {
            error: {
              code: 403,
              message: "The request cannot be completed because you have exceeded your quota.",
            },
          },
          403,
        ),
      )
      const error = await channel.currentBroadcast({ fetchImpl }).catch((e: Error) => e)
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe(
        "YouTube playlistItems failed (HTTP 403): The request cannot be completed because you have exceeded your quota.",
      )
      expect((error as Error).message).not.toContain("secret-key")
    })

    it("prefers the channels listed in the admin over the variable", async () => {
      configure()
      const fetchImpl = youtube([])
      await channel.currentBroadcast({
        channelIds: [" UCfromAdmin ", "", "UCfromAdmin"],
        fetchImpl,
      })
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      const uploadsUrl = new URL(String(fetchImpl.mock.calls[0]![0]))
      expect(uploadsUrl.searchParams.get("playlistId")).toBe("UUfromAdmin")
    })

    it("reads a comma-separated list from the variable", () => {
      vi.stubEnv("EXAMPLE_CHANNEL_IDS", "UCone, UCtwo,")
      expect(channel.channels()).toEqual(["UCone", "UCtwo"])
      expect(channel.channels([])).toEqual(["UCone", "UCtwo"])
      expect(channel.channels(["UCadmin"])).toEqual(["UCadmin"])
    })

    it("watches every channel, reading all their statuses in one request", async () => {
      configure()
      const uploads: Record<string, string[]> = { UUone: ["a1", "a2"], UUtwo: ["b1"] }
      const fetchImpl = vi.fn<typeof fetch>(async (input) => {
        const url = new URL(String(input))
        if (url.pathname.endsWith("/playlistItems")) {
          const ids = uploads[url.searchParams.get("playlistId")!] ?? []
          return reply({ items: ids.map((videoId) => ({ contentDetails: { videoId } })) })
        }
        return reply({
          items: [
            { id: "a1", snippet: { title: "a1", liveBroadcastContent: "none" } },
            { id: "a2", snippet: { title: "a2", liveBroadcastContent: "none" } },
            { id: "b1", snippet: { title: "Second channel, live", liveBroadcastContent: "live" } },
          ],
        })
      })
      const broadcast = await channel.currentBroadcast({
        channelIds: ["UCone", "UCtwo"],
        fetchImpl,
      })
      expect(broadcast).toMatchObject({ videoId: "b1", status: "live" })
      expect(fetchImpl).toHaveBeenCalledTimes(3)
      expect(new URL(String(fetchImpl.mock.calls[2]![0])).searchParams.get("id")).toBe("a1,a2,b1")
    })

    it("refuses to call YouTube without a key or a channel", async () => {
      vi.stubEnv("EXAMPLE_CHANNEL_IDS", "")
      vi.stubEnv("EXAMPLE_YOUTUBE_KEY", "")
      const fetchImpl = vi.fn<typeof fetch>()
      await expect(channel.currentBroadcast({ fetchImpl })).rejects.toThrow(
        "YouTube needs EXAMPLE_YOUTUBE_KEY",
      )
      vi.stubEnv("EXAMPLE_YOUTUBE_KEY", "secret-key")
      await expect(channel.currentBroadcast({ fetchImpl })).rejects.toThrow(
        "YouTube needs a channel: list one in the admin or set EXAMPLE_CHANNEL_IDS",
      )
      expect(fetchImpl).not.toHaveBeenCalled()
    })
  })
})
