// @vitest-environment node
import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { config, proxy } from "../proxy"

const request = (headers: Record<string, string> = {}, method = "POST"): NextRequest =>
  new NextRequest("https://pragmaticpapers.com/articles/some-article", { method, headers })

// A real Server Action ID: 42 hex characters (an info byte plus a SHA-1).
const VALID_ID = "40" + "0123456789abcdef0123456789abcdef01234567"

describe("proxy: Next-Action header", () => {
  it("passes a well-formed Server Action ID through to Next", () => {
    const response = proxy(request({ "next-action": VALID_ID }))
    expect(response.status).toBe(200)
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("passes requests without the header through", () => {
    expect(proxy(request({}, "GET")).headers.get("x-middleware-next")).toBe("1")
    expect(proxy(request()).headers.get("x-middleware-next")).toBe("1")
  })

  // Values seen from scanners on a PR preview (#1107), plus near misses.
  it.each([
    "x",
    "17794517",
    "1f1c13e5",
    "",
    VALID_ID.slice(1),
    VALID_ID + "0",
    VALID_ID.slice(0, -1) + "g",
    VALID_ID.slice(0, -1) + "\n",
  ])("answers a malformed ID %j with a 404 before Next sees it", (id) => {
    const response = proxy(request({ "next-action": id }))
    expect(response.status).toBe(404)
    expect(response.headers.get("x-middleware-next")).toBeNull()
  })

  it("runs on page routes, where Next resolves Server Actions", () => {
    const [matcher] = config.matcher
    expect(new RegExp(`^${matcher}$`).test("/articles/some-article")).toBe(true)
  })
})
