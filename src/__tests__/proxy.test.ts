// @vitest-environment node
import { SERVER_REFERENCE_ID_LENGTH } from "next/dist/shared/lib/server-reference-info"
import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { proxy } from "../proxy"

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

  // If a Next upgrade changes the ID length, the proxy would 404 every real action.
  it("matches the ID length Next expects", () => {
    expect(VALID_ID).toHaveLength(SERVER_REFERENCE_ID_LENGTH)
  })

  // A value seen from scanners on a PR preview, plus near misses.
  it.each(["x", VALID_ID.slice(1), VALID_ID + "0", VALID_ID.slice(0, -1) + "g"])(
    "answers a malformed ID %j with a 404 before Next sees it",
    (id) => {
      const response = proxy(request({ "next-action": id }))
      expect(response.status).toBe(404)
      expect(response.headers.get("x-middleware-next")).toBeNull()
    },
  )
})

const get = (path: string): NextRequest => new NextRequest(`https://pragmaticpapers.com${path}`)

describe("proxy: dotfile probes", () => {
  it.each(["/.env", "/.env.local", "/.git/config", "/.git/HEAD", "/articles/.aws/credentials"])(
    "answers %s with a 404 before Next sees it",
    (path) => {
      const response = proxy(get(path))
      expect(response.status).toBe(404)
      expect(response.headers.get("x-middleware-next")).toBeNull()
    },
  )

  it.each([
    "/.well-known/security.txt",
    "/.well-known",
    "/articles/some-article",
    "/articles/v1.2-release",
  ])("passes %s through to Next", (path) => {
    expect(proxy(get(path)).headers.get("x-middleware-next")).toBe("1")
  })

  it("still turns away look-alikes of /.well-known", () => {
    expect(proxy(get("/.well-known-secrets")).status).toBe(404)
  })
})

describe("proxy: multipart bodies without a boundary", () => {
  it.each(["multipart/form-data", "multipart/form-data; charset=utf-8", "Multipart/Form-Data"])(
    "answers a POST with Content-Type %j with a 400",
    (contentType) => {
      const response = proxy(request({ "content-type": contentType }))
      expect(response.status).toBe(400)
      expect(response.headers.get("x-middleware-next")).toBeNull()
    },
  )

  it("passes a multipart POST with a boundary through", () => {
    const response = proxy(
      request({ "content-type": "multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxk" }),
    )
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("passes other content types and methods through", () => {
    expect(
      proxy(request({ "content-type": "application/json" })).headers.get("x-middleware-next"),
    ).toBe("1")
    expect(
      proxy(request({ "content-type": "multipart/form-data" }, "GET")).headers.get(
        "x-middleware-next",
      ),
    ).toBe("1")
  })
})
