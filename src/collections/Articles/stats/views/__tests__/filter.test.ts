import { describe, expect, it } from "vitest"

import { clientAddress, createViewLimiter, isLikelyBot } from "../filter"

describe("isLikelyBot", () => {
  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0 Safari/537.36",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php) preview",
    "Chrome-Lighthouse",
    "python-requests/2.32",
    "curl/8.7.1",
    "",
    null,
    undefined,
  ])("treats %j as a bot", (agent) => {
    expect(isLikelyBot(agent)).toBe(true)
  })

  it.each([
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148",
  ])("treats a browser as a reader: %s", (agent) => {
    expect(isLikelyBot(agent)).toBe(false)
  })
})

describe("clientAddress", () => {
  it("prefers Cloudflare's header, then the first forwarded address, then x-real-ip", () => {
    expect(
      clientAddress(new Headers({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" })),
    ).toBe("1.1.1.1")
    expect(clientAddress(new Headers({ "x-forwarded-for": " 2.2.2.2 , 3.3.3.3" }))).toBe("2.2.2.2")
    expect(clientAddress(new Headers({ "x-real-ip": "4.4.4.4" }))).toBe("4.4.4.4")
    expect(clientAddress(new Headers())).toBeNull()
  })
})

describe("createViewLimiter", () => {
  it("lets an address add up to the limit to one article per window", () => {
    let time = 0
    const limiter = createViewLimiter({ limit: 2, windowMs: 1000, now: () => time })

    expect(limiter.allow("a", 1)).toBe(true)
    expect(limiter.allow("a", 1)).toBe(true)
    expect(limiter.allow("a", 1)).toBe(false)
    // Another article, or another address, has its own allowance.
    expect(limiter.allow("a", 2)).toBe(true)
    expect(limiter.allow("b", 1)).toBe(true)

    time = 1000
    expect(limiter.allow("a", 1)).toBe(true)
  })

  it("drops the oldest windows once it tracks too many", () => {
    const limiter = createViewLimiter({ limit: 1, maxEntries: 10 })
    for (let id = 0; id < 10; id++) limiter.allow("a", id)
    expect(limiter.allow("a", 0)).toBe(false)

    // The eleventh pair pushes the oldest out, so the first article is allowed again.
    expect(limiter.allow("a", 10)).toBe(true)
    expect(limiter.allow("a", 0)).toBe(true)
  })

  it("forgets everything on clear", () => {
    const limiter = createViewLimiter({ limit: 1 })
    limiter.allow("a", 1)
    limiter.clear()
    expect(limiter.allow("a", 1)).toBe(true)
  })
})
