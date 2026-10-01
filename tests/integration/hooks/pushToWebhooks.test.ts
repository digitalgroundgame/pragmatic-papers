import type { Payload } from "payload"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { Volume, Webhook } from "@/payload-types"
import { createVolume } from "../helpers/content"
import { getPayload } from "../helpers/testUsers"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/**
 * `pushToWebhooks` announces a volume to every webhook (Discord) the first time it is published,
 * and records the push on the webhook so a later publish doesn't announce it twice. The HTTP
 * call is stubbed; the webhook reads and writes go to the real database.
 */
let payload: Payload
const fetchMock = vi.fn<typeof fetch>()

const HOOKS = "https://hooks.example.test"

beforeAll(async () => {
  payload = await getPayload()
})

beforeEach(async () => {
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
  vi.spyOn(console, "error").mockImplementation(() => undefined)
  await payload.delete({ collection: "webhooks", where: { id: { exists: true } } })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  fetchMock.mockReset()
})

function createWebhook(data: Partial<Webhook> = {}): Promise<Webhook> {
  return payload.create({
    collection: "webhooks",
    data: { name: "Discord", url: `${HOOKS}/discord`, ...data },
  })
}

/** Publishes a draft volume for the first time, which is what fires the push. */
function publish(volume: Volume): Promise<Volume> {
  return payload.update({
    collection: "volumes",
    id: volume.id,
    overrideAccess: true,
    context: { disableRevalidate: true },
    data: { _status: "published" },
  })
}

async function pushedTo(webhook: Webhook): Promise<Webhook["pushed"]> {
  const fresh = await payload.findByID({ collection: "webhooks", id: webhook.id })
  return fresh.pushed ?? []
}

/** What went to a webhook. Payload's own telemetry goes through `fetch` too, so leave it out. */
const posted = (): { url: string; body: { content: string; username: string } }[] =>
  fetchMock.mock.calls
    .filter(([url]) => String(url).startsWith(HOOKS))
    .map(([url, init]) => ({ url: String(url), body: JSON.parse(String(init?.body)) }))

describe("pushToWebhooks", () => {
  it("announces a volume's first publish to every webhook and records it on each", async () => {
    const discord = await createWebhook()
    const other = await createWebhook({ name: "Other", url: `${HOOKS}/other` })
    const volume = await createVolume({ _status: "draft" })

    // Only `_status` is sent, so the link has to come from the saved volume, not the request.
    const published = await publish(volume)

    const announcement = expect.objectContaining({
      content: `http://localhost:8000/volumes/${published.slug}`,
      username: "The Pragmatic Papers",
    })
    expect(posted()).toEqual(
      expect.arrayContaining([
        { url: discord.url, body: announcement },
        { url: other.url, body: announcement },
      ]),
    )
    expect(posted()).toHaveLength(2)

    const record = expect.objectContaining({
      volumeNumber: volume.volumeNumber,
      timePushed: expect.any(String),
    })
    expect(await pushedTo(discord)).toEqual([record])
    expect(await pushedTo(other)).toEqual([record])
  })

  it("does nothing when there are no webhooks", async () => {
    const volume = await createVolume({ _status: "draft" })

    await publish(volume)

    expect(posted()).toEqual([])
  })

  it("skips a webhook that already announced the volume", async () => {
    const volume = await createVolume({ _status: "draft" })
    await createWebhook({ pushed: [{ volumeNumber: volume.volumeNumber, timePushed: null }] })

    await publish(volume)

    expect(posted()).toEqual([])
  })

  it("still recognises a push recorded the old way, under the volume's ID", async () => {
    const volume = await createVolume({ _status: "draft" })
    await createWebhook({ pushed: [{ id: String(volume.id), volumeNumber: null }] })

    await publish(volume)

    expect(posted()).toEqual([])
  })

  it("doesn't announce a volume created already published", async () => {
    await createWebhook()

    await createVolume({ _status: "published" })

    expect(posted()).toEqual([])
  })

  it("doesn't announce a later save of a published volume", async () => {
    await createWebhook()
    const volume = await createVolume({ _status: "draft" })
    await publish(volume)
    fetchMock.mockClear()

    await payload.update({
      collection: "volumes",
      id: volume.id,
      overrideAccess: true,
      context: { disableRevalidate: true },
      data: { title: "Corrected title" },
    })

    expect(posted()).toEqual([])
  })

  it("records nothing for a webhook that rejects the post, and still tries the rest", async () => {
    const failing = await createWebhook({ name: "Failing", url: `${HOOKS}/failing` })
    const working = await createWebhook()
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith("/failing")
        ? new Response(null, { status: 500, statusText: "Server Error" })
        : new Response(null, { status: 204 }),
    )
    const volume = await createVolume({ _status: "draft" })

    await publish(volume)

    expect(posted().map(({ url }) => url)).toEqual(
      expect.arrayContaining([failing.url, working.url]),
    )
    expect(await pushedTo(failing)).toEqual([])
    expect(await pushedTo(working)).toEqual([
      expect.objectContaining({ volumeNumber: volume.volumeNumber }),
    ])
  })

  it("records nothing when the webhook can't be reached", async () => {
    const discord = await createWebhook()
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))
    const volume = await createVolume({ _status: "draft" })

    await publish(volume)

    expect(await pushedTo(discord)).toEqual([])
  })
})
