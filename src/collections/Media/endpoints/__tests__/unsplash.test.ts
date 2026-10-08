import type { PayloadRequest } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { unsplash } from "@/integrations"
import type { UnsplashPhoto } from "@/integrations/unsplash"
import type { User } from "@/payload-types"

import { UNSPLASH_IMPORT_WIDTH, unsplashFileHandler, unsplashSearchHandler } from "../unsplash"

const photo = { id: "abc123", width: 6000 } as UnsplashPhoto
const logger = { warn: vi.fn() }

const request = (
  user: Partial<User> | null,
  { query = {}, routeParams = {} }: { query?: object; routeParams?: object } = {},
) => ({ user, query, routeParams, payload: { logger } }) as unknown as PayloadRequest

const writer = { id: 1, roles: ["writer"] } as Partial<User>

beforeEach(() => {
  vi.stubEnv("UNSPLASH_ACCESS_KEY", "key")
  vi.spyOn(unsplash, "search").mockResolvedValue({
    total: 0,
    totalPages: 0,
    results: [],
    rateLimit: null,
  })
  vi.spyOn(unsplash, "photo").mockResolvedValue(photo)
  vi.spyOn(unsplash, "image").mockResolvedValue(
    new Response("jpeg-bytes", { headers: { "Content-Type": "image/jpeg" } }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("unsplashSearchHandler", () => {
  it("searches for staff, passing a known orientation and a clamped page", async () => {
    const res = await unsplashSearchHandler(
      request(writer, { query: { query: " lighthouse ", page: "500", orientation: "portrait" } }),
    )

    expect(res.status).toBe(200)
    expect(unsplash.search).toHaveBeenCalledWith({
      query: "lighthouse",
      page: 100,
      orientation: "portrait",
    })
    await expect(res.json()).resolves.toMatchObject({ results: [], homeUrl: expect.any(String) })
  })

  it("drops an orientation Unsplash doesn't know", async () => {
    await unsplashSearchHandler(request(writer, { query: { query: "x", orientation: "round" } }))
    expect(unsplash.search).toHaveBeenCalledWith(
      expect.objectContaining({ orientation: undefined }),
    )
  })

  it("asks for a search term", async () => {
    const res = await unsplashSearchHandler(request(writer, { query: { query: "  " } }))
    expect(res.status).toBe(400)
  })

  it.each([
    [null, 401],
    [{ id: 2, roles: ["member"] }, 403],
  ])("refuses %o with %i", async (user, status) => {
    const res = await unsplashSearchHandler(
      request(user as Partial<User> | null, { query: { query: "x" } }),
    )
    expect(res.status).toBe(status)
    expect(unsplash.search).not.toHaveBeenCalled()
  })

  it("says Unsplash isn't set up when the key is missing", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "")
    const res = await unsplashSearchHandler(request(writer, { query: { query: "x" } }))
    expect(res.status).toBe(503)
  })

  it("logs a failed search and answers 502 without Unsplash's details", async () => {
    vi.mocked(unsplash.search).mockRejectedValue(new Error("HTTP 403: Rate Limit Exceeded"))
    const res = await unsplashSearchHandler(request(writer, { query: { query: "x" } }))
    expect(res.status).toBe(502)
    expect(logger.warn).toHaveBeenCalled()
  })
})

describe("unsplashFileHandler", () => {
  it("streams the photo's file, looked up by id, at the import width", async () => {
    const res = await unsplashFileHandler(request(writer, { routeParams: { photoId: "abc123" } }))

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("image/jpeg")
    await expect(res.text()).resolves.toBe("jpeg-bytes")
    expect(unsplash.photo).toHaveBeenCalledWith("abc123")
    expect(unsplash.image).toHaveBeenCalledWith(photo, UNSPLASH_IMPORT_WIDTH)
  })

  it("rejects an id that isn't Unsplash's shape", async () => {
    const res = await unsplashFileHandler(request(writer, { routeParams: { photoId: "../me" } }))
    expect(res.status).toBe(400)
    expect(unsplash.photo).not.toHaveBeenCalled()
  })

  it("logs a failed download and answers 502", async () => {
    vi.mocked(unsplash.image).mockRejectedValue(new Error("Unsplash image failed (HTTP 404)"))
    const res = await unsplashFileHandler(request(writer, { routeParams: { photoId: "abc123" } }))
    expect(res.status).toBe(502)
    await expect(res.json()).resolves.toEqual({
      error: "Unsplash download failed. Try again in a moment.",
    })
    expect(logger.warn).toHaveBeenCalled()
  })

  it("refuses anyone but staff", async () => {
    const res = await unsplashFileHandler(request(null, { routeParams: { photoId: "abc123" } }))
    expect(res.status).toBe(401)
  })
})
