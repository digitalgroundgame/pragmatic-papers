import { afterEach, describe, expect, it, vi } from "vitest"

import { integrationStatus } from "../../types"
import { unsplashApp } from "../index"

const app = unsplashApp({
  id: "unsplash-example",
  label: "Example Unsplash app",
  keyEnv: "EXAMPLE_UNSPLASH_KEY",
  appNameEnv: "EXAMPLE_UNSPLASH_APP",
  defaultAppName: "example_app",
})

/** Unsplash's photo object, cut to what the integration reads plus a field it ignores. */
const rawPhoto = {
  id: "abc123",
  width: 6000,
  height: 4000,
  color: "#405060",
  alt_description: "a lighthouse at dusk",
  description: null,
  urls: {
    raw: "https://images.unsplash.com/photo-1?ixid=xyz",
    small: "https://images.unsplash.com/photo-1?ixid=xyz&w=400",
  },
  links: {
    html: "https://unsplash.com/photos/abc123",
    download_location: "https://api.unsplash.com/photos/abc123/download?ixid=xyz",
  },
  user: { name: "Ada Lovelace", username: "ada", links: { html: "https://unsplash.com/@ada" } },
  likes: 12,
}

const reply = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("unsplashApp", () => {
  it("needs only the access key, and never reports its value", () => {
    vi.stubEnv("EXAMPLE_UNSPLASH_KEY", "")
    expect(integrationStatus(app)).toMatchObject({
      service: "Unsplash",
      configured: false,
      missing: ["EXAMPLE_UNSPLASH_KEY"],
    })

    vi.stubEnv("EXAMPLE_UNSPLASH_KEY", "secret-key")
    const status = integrationStatus(app)
    expect(status).toMatchObject({ configured: true, target: "unsplash:app/example_app" })
    expect(JSON.stringify(status)).not.toContain("secret-key")
  })

  it("searches with the key as Client-ID and trims each photo to what the site uses", async () => {
    vi.stubEnv("EXAMPLE_UNSPLASH_KEY", "secret-key")
    const fetchImpl = vi.fn(async () =>
      reply(200, { total: 1, total_pages: 1, results: [rawPhoto] }),
    )

    const page = await app.search(
      { query: "lighthouse", page: 2, orientation: "landscape" },
      { fetchImpl },
    )

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const sent = new URL(url)
    expect(sent.origin + sent.pathname).toBe("https://api.unsplash.com/search/photos")
    expect(Object.fromEntries(sent.searchParams)).toEqual({
      query: "lighthouse",
      page: "2",
      per_page: "24",
      content_filter: "high",
      orientation: "landscape",
    })
    expect(init.headers).toMatchObject({ Authorization: "Client-ID secret-key" })

    expect(page).toEqual({
      total: 1,
      totalPages: 1,
      results: [
        {
          id: "abc123",
          width: 6000,
          height: 4000,
          color: "#405060",
          alt: "a lighthouse at dusk",
          thumbUrl: rawPhoto.urls.small,
          rawUrl: rawPhoto.urls.raw,
          pageUrl: "https://unsplash.com/photos/abc123?utm_source=example_app&utm_medium=referral",
          downloadLocation: rawPhoto.links.download_location,
          photographer: {
            name: "Ada Lovelace",
            username: "ada",
            profileUrl: "https://unsplash.com/@ada?utm_source=example_app&utm_medium=referral",
          },
        },
      ],
    })
  })

  it("names itself in referral links as the app name variable says", () => {
    vi.stubEnv("EXAMPLE_UNSPLASH_APP", "pp_prod")
    expect(app.homeUrl()).toBe("https://unsplash.com/?utm_source=pp_prod&utm_medium=referral")
  })

  it("counts a download by calling the photo's download location with the key", async () => {
    vi.stubEnv("EXAMPLE_UNSPLASH_KEY", "secret-key")
    const fetchImpl = vi.fn(async () => reply(200, { url: "https://images.unsplash.com/x" }))
    const photo = await app.photo("abc123", { fetchImpl: async () => reply(200, rawPhoto) })

    await app.trackDownload(photo, { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledWith(
      rawPhoto.links.download_location,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Client-ID secret-key" }),
      }),
    )
  })

  it("asks Unsplash's CDN for a JPEG no wider than asked, or than the original", async () => {
    vi.stubEnv("EXAMPLE_UNSPLASH_KEY", "k")
    const photo = await app.photo("abc123", { fetchImpl: async () => reply(200, rawPhoto) })
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL) => new Response("jpeg"))

    await app.image(photo, 2400, { fetchImpl })
    await app.image({ ...photo, width: 800 }, 2400, { fetchImpl })

    const widths = fetchImpl.mock.calls.map(([url]) =>
      new URL(url as unknown as string).searchParams.get("w"),
    )
    expect(widths).toEqual(["2400", "800"])
    const first = new URL(String(fetchImpl.mock.calls[0]![0]))
    expect(first.hostname).toBe("images.unsplash.com")
    expect(first.searchParams.get("fm")).toBe("jpg")
    expect(first.searchParams.get("ixid")).toBe("xyz")
  })

  it("refuses to fetch an image or count a download anywhere but Unsplash", async () => {
    vi.stubEnv("EXAMPLE_UNSPLASH_KEY", "secret-key")
    const photo = await app.photo("abc123", { fetchImpl: async () => reply(200, rawPhoto) })
    const fetchImpl = vi.fn()

    await expect(
      app.image({ ...photo, rawUrl: "https://evil.example/x.jpg" }, 100, { fetchImpl }),
    ).rejects.toThrow("Not an Unsplash image URL")
    await expect(
      app.trackDownload(
        { ...photo, downloadLocation: "https://evil.example/steal" },
        { fetchImpl },
      ),
    ).rejects.toThrow("Not an Unsplash API URL")
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("passes Unsplash's error messages on, without the key", async () => {
    vi.stubEnv("EXAMPLE_UNSPLASH_KEY", "secret-key")
    const fetchImpl = vi.fn(async () =>
      reply(401, { errors: ["OAuth error: The access token is invalid"] }),
    )

    const failure = app.search({ query: "x" }, { fetchImpl })

    await expect(failure).rejects.toThrow(
      "Unsplash request failed (HTTP 401): OAuth error: The access token is invalid",
    )
    await expect(failure).rejects.not.toThrow("secret-key")
  })

  it("throws before calling out when the key is missing", async () => {
    vi.stubEnv("EXAMPLE_UNSPLASH_KEY", "")
    const fetchImpl = vi.fn()
    await expect(app.photo("abc123", { fetchImpl })).rejects.toThrow(
      "Unsplash needs EXAMPLE_UNSPLASH_KEY",
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
