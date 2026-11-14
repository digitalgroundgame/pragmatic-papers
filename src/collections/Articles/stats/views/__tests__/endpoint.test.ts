import type { PayloadRequest } from "payload"
import { afterEach, describe, expect, it, vi } from "vitest"

import { recordArticleViewHandler, viewLimiter } from "../endpoint"

const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0"

function request(id: string, headers: Record<string, string> = { "user-agent": BROWSER }) {
  const execute = vi.fn(async () => ({ rows: [{ article_id: Number(id) }] }))
  const warn = vi.fn()
  const req = {
    routeParams: { id },
    headers: new Headers(headers),
    payload: { db: { drizzle: { execute } }, logger: { warn } },
  } as unknown as PayloadRequest
  return { req, execute, warn }
}

afterEach(() => {
  viewLimiter.clear()
})

describe("recordArticleViewHandler", () => {
  it("counts a reader's visit and answers 204, uncached", async () => {
    const { req, execute } = request("7")
    const response = await recordArticleViewHandler(req)

    expect(response.status).toBe(204)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it.each(["x", "0", "-1", "2.5"])("refuses the id %s", async (id) => {
    const { req, execute } = request(id)
    expect((await recordArticleViewHandler(req)).status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })

  it("doesn't count a bot", async () => {
    const { req, execute } = request("7", { "user-agent": "Googlebot/2.1" })
    expect((await recordArticleViewHandler(req)).status).toBe(204)
    expect(execute).not.toHaveBeenCalled()
  })

  it("stops counting an address past its limit for the article", async () => {
    const headers = { "user-agent": BROWSER, "cf-connecting-ip": "203.0.113.9" }
    const calls: ReturnType<typeof vi.fn>[] = []
    for (let i = 0; i < 21; i++) {
      const { req, execute } = request("7", headers)
      await recordArticleViewHandler(req)
      calls.push(execute)
    }
    expect(calls.filter((execute) => execute.mock.calls.length > 0)).toHaveLength(20)
  })

  it("logs a failed count and still answers 204", async () => {
    const { req, execute, warn } = request("7")
    execute.mockRejectedValue(new Error("connection reset"))

    expect((await recordArticleViewHandler(req)).status).toBe(204)
    expect(warn).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Counting a view of article 7 failed",
    )
  })
})
