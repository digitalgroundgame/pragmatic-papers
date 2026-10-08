import type { Payload } from "payload"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { Media } from "@/payload-types"

import { testFile } from "../fixtures/media"
import { createUser, getPayload } from "../helpers/testUsers"

/** Unsplash's answer for one photo, as `GET /photos/:id` returns it. */
const rawPhoto = {
  id: "abc123",
  width: 6000,
  height: 4000,
  color: "#405060",
  alt_description: "a lighthouse at dusk",
  urls: { raw: "https://images.unsplash.com/photo-1", small: "https://images.unsplash.com/s" },
  links: {
    html: "https://unsplash.com/photos/abc123",
    download_location: "https://api.unsplash.com/photos/abc123/download?ixid=xyz",
  },
  user: { name: "Ada Lovelace", username: "ada", links: { html: "https://unsplash.com/@ada" } },
}

describe("media picked from Unsplash", () => {
  let payload: Payload
  const unsplashCalls: string[] = []

  beforeAll(async () => {
    payload = await getPayload()
  })

  beforeEach(() => {
    unsplashCalls.length = 0
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-key")
    const realFetch = globalThis.fetch
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (!url.startsWith("https://api.unsplash.com/")) return realFetch(input, init)
      unsplashCalls.push(url)
      return Response.json(url.includes("/download") ? { url: rawPhoto.urls.raw } : rawPhoto)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("credits the photographer, keeps the id and counts the download on create", async () => {
    const writer = await createUser("writer")

    const media = await payload.create({
      collection: "media",
      overrideAccess: false,
      context: { disableRevalidate: true },
      file: testFile(),
      data: { unsplashId: "abc123" } as unknown as Media,
      user: writer,
    })

    expect(media.unsplashId).toBe("abc123")
    expect(media.alt).toBe("a lighthouse at dusk")
    const caption = JSON.stringify(media.caption)
    expect(caption).toContain('"text":"Ada Lovelace"')
    expect(caption).toContain(
      "https://unsplash.com/@ada?utm_source=pragmatic_papers_development&utm_medium=referral",
    )
    await vi.waitFor(() => expect(unsplashCalls).toContain(rawPhoto.links.download_location))
  })

  it("doesn't credit again when the media is saved later", async () => {
    const writer = await createUser("writer")
    const media = await payload.create({
      collection: "media",
      overrideAccess: false,
      context: { disableRevalidate: true },
      file: testFile(),
      data: { unsplashId: "abc123" } as unknown as Media,
      user: writer,
    })
    unsplashCalls.length = 0

    const updated = await payload.update({
      collection: "media",
      id: media.id,
      overrideAccess: false,
      context: { disableRevalidate: true },
      data: { alt: "Edited" },
      user: writer,
    })

    expect(unsplashCalls).toEqual([])
    expect(JSON.stringify(updated.caption).match(/Ada Lovelace/g)).toHaveLength(1)
  })
})
