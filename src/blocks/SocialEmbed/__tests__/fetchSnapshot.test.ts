// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { FieldHookArgs } from "payload"

import type { Article, SocialEmbedBlock } from "@/payload-types"

import { fetchSnapshot } from "../hooks/fetchSnapshot"

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

afterEach(() => {
  fetchMock.mockReset()
})

const URL = "https://x.com/a/status/1"
const TWEET = '<blockquote class="twitter-tweet"><p>Hi</p></blockquote>'
const INJECTED = `${TWEET}<img src="x" onerror="alert(1)"><script>alert(1)</script>`

type Args = FieldHookArgs<Article, string, SocialEmbedBlock>

/** The hook, run as a save whose block carries `snapshot`, with this request. */
async function save(
  req: { query?: Record<string, unknown>; context?: Record<string, unknown> },
  siblingData: Partial<SocialEmbedBlock>,
): Promise<Partial<SocialEmbedBlock>> {
  await fetchSnapshot({ req, siblingData, value: siblingData.url } as unknown as Args)
  return siblingData
}

describe("fetchSnapshot", () => {
  it("sanitizes the snapshot an autosave sends, without fetching", async () => {
    const saved = await save(
      { query: { autosave: "true" } },
      { url: URL, platform: "twitter", snapshot: { status: "ok", html: INJECTED } },
    )

    expect(saved.snapshot).toEqual({ status: "ok", html: TWEET })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("sanitizes the snapshot of a save that skips the fetch", async () => {
    const saved = await save(
      { context: { skipSocialEmbedSnapshot: true } },
      { url: URL, platform: "twitter", snapshot: { status: "ok", html: INJECTED } },
    )

    expect(saved.snapshot?.html).toBe(TWEET)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("drops an autosave's HTML when no platform says what it may hold", async () => {
    const saved = await save(
      { query: { autosave: "true" } },
      { url: "https://example.com", snapshot: { status: "ok", html: INJECTED } },
    )

    expect(saved.snapshot?.html).toBeUndefined()
  })

  it("leaves an autosave without a snapshot alone", async () => {
    const saved = await save({ query: { autosave: "true" } }, { url: URL, platform: "twitter" })

    expect(saved.snapshot).toBeUndefined()
  })

  it("drops the HTML of a block whose platform isn't known", async () => {
    const saved = await save(
      {},
      { url: "https://example.com", snapshot: { status: "ok", html: INJECTED } },
    )

    expect(saved.snapshot).toMatchObject({ status: "not_found", title: "No platform found" })
    expect(saved.snapshot?.html).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("keeps none of the script when the platform's lookup fails", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 403, statusText: "Forbidden" }))

    const saved = await save(
      {},
      { url: URL, platform: "twitter", snapshot: { status: "ok", html: INJECTED } },
    )

    expect(saved.snapshot).toMatchObject({ status: "forbidden", html: TWEET })
  })

  it("replaces the snapshot with the platform's own when the lookup succeeds", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        type: "rich",
        version: "1.0",
        url: URL,
        html: `${TWEET}<script async src="https://platform.twitter.com/widgets.js"></script>`,
      }),
    )

    const saved = await save(
      {},
      { url: URL, platform: "twitter", snapshot: { status: "ok", html: INJECTED } },
    )

    expect(saved.snapshot).toMatchObject({ status: "ok", html: TWEET })
  })
})
