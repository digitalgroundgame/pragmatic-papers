// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchOEmbed, OEmbedRequestError } from "../helpers/fetchOEmbed"

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

const endpoint = new URL("https://provider.example/oembed?url=x")

const errorOf = async () => {
  const result = await fetchOEmbed(endpoint)
  if (result.success) throw new Error("expected a failure")
  return result.error
}

afterEach(() => {
  fetchMock.mockReset()
})

describe("fetchOEmbed", () => {
  it("returns a valid oEmbed response", async () => {
    const body = { type: "video", version: "1.0", html: "<iframe></iframe>" }
    fetchMock.mockResolvedValue(Response.json(body))

    await expect(fetchOEmbed(endpoint)).resolves.toEqual({ success: true, value: body })
    expect(fetchMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it("passes the caller's init through", async () => {
    fetchMock.mockResolvedValue(Response.json({ type: "link", version: "1.0" }))

    await fetchOEmbed(endpoint, { cache: "no-store", headers: { a: "b" } })

    expect(fetchMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({ cache: "no-store", headers: { a: "b" } }),
    )
  })

  it("reports a non-OK response as forbidden, with its status", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 404, statusText: "Not Found" }))

    const error = await errorOf()

    expect(error).toBeInstanceOf(OEmbedRequestError)
    expect(error).toMatchObject({
      code: "forbidden",
      status: 404,
      message: "Failed to fetch oEmbed: Not Found",
    })
  })

  it.each([
    ["an unknown type", { type: "audio", version: "1.0" }],
    ["rich without html", { type: "rich", version: "1.0" }],
    ["a non-object", "hello"],
    ["null", null],
  ])("rejects %s as an invalid response", async (_, body) => {
    fetchMock.mockResolvedValue(Response.json(body))

    expect(await errorOf()).toMatchObject({ code: "invalid_oembed_response" })
  })

  it("reports a timeout", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"))

    expect(await errorOf()).toMatchObject({ code: "timeout" })
  })

  it("reports an abort", async () => {
    fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"))

    expect(await errorOf()).toMatchObject({ code: "aborted" })
  })

  it("wraps any other failure as a generic error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    const error = await errorOf()

    expect(error).toBeInstanceOf(OEmbedRequestError)
    expect(error).toMatchObject({ code: "error", message: "TypeError: fetch failed" })
  })
})

describe("OEmbedRequestError", () => {
  it("defaults to the generic error code", () => {
    const error = new OEmbedRequestError("boom")

    expect(error).toMatchObject({ name: "OEmbedRequestError", code: "error", status: undefined })
  })
})
