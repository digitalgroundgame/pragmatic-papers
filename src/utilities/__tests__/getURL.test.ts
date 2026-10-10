import { afterEach, describe, expect, it, vi } from "vitest"

import { absoluteURL, getClientURL, getSiteURL } from "@/utilities/getURL"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("getSiteURL", () => {
  it("uses SERVER_URL", () => {
    vi.stubEnv("SERVER_URL", "https://pragmaticpapers.com")

    expect(getSiteURL()).toBe("https://pragmaticpapers.com")
  })

  it("drops a trailing slash", () => {
    vi.stubEnv("SERVER_URL", "https://pragmaticpapers.com/")

    expect(getSiteURL()).toBe("https://pragmaticpapers.com")
  })

  // Read when called, not compiled in: the same build serves whatever the server is given.
  it("reads SERVER_URL at call time", () => {
    vi.stubEnv("SERVER_URL", "https://pr-1.pragmaticpapers.com")
    expect(getSiteURL()).toBe("https://pr-1.pragmaticpapers.com")

    vi.stubEnv("SERVER_URL", "http://localhost:3000")
    expect(getSiteURL()).toBe("http://localhost:3000")
  })

  it("ignores NEXT_PUBLIC_SERVER_URL", () => {
    vi.stubEnv("SERVER_URL", undefined)
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://pragmaticpapers.com")

    expect(getSiteURL()).toBe("http://localhost:8000")
  })

  it.each([undefined, ""])("falls back to the dev server when it is %j", (value) => {
    vi.stubEnv("SERVER_URL", value)

    expect(getSiteURL()).toBe("http://localhost:8000")
  })
})

describe("getClientURL", () => {
  it("reads the origin from the browser, ignoring the env", () => {
    vi.stubEnv("SERVER_URL", "https://pragmaticpapers.com")
    vi.stubGlobal("window", { location: { origin: "https://preview.example.com" } })

    expect(getClientURL()).toBe("https://preview.example.com")
  })

  it("uses SERVER_URL on the server", () => {
    vi.stubGlobal("window", undefined)
    vi.stubEnv("SERVER_URL", "https://pragmaticpapers.com/")

    expect(getClientURL()).toBe("https://pragmaticpapers.com")
  })

  it("returns an empty string on the server without SERVER_URL", () => {
    vi.stubGlobal("window", undefined)
    vi.stubEnv("SERVER_URL", undefined)

    expect(getClientURL()).toBe("")
  })
})

describe("absoluteURL", () => {
  it("prefixes a path with the site", () => {
    vi.stubEnv("SERVER_URL", "https://pragmaticpapers.com")

    expect(absoluteURL("/articles/a")).toBe("https://pragmaticpapers.com/articles/a")
    expect(absoluteURL("articles/a")).toBe("https://pragmaticpapers.com/articles/a")
  })

  it("takes another base", () => {
    expect(absoluteURL("/a", "https://example.test")).toBe("https://example.test/a")
  })

  it("passes absolute URLs through", () => {
    expect(absoluteURL("https://cdn.example.test/x.jpg")).toBe("https://cdn.example.test/x.jpg")
  })
})
