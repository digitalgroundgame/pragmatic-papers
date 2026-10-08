import type { Event, StackFrame } from "@sentry/nextjs"
import { describe, expect, it } from "vitest"

import { isOurChunk, thirdPartyFramesIntegration } from "../sentryThirdPartyFrames"

const ORIGIN = "https://pragmaticpapers.test"
const OURS = `${ORIGIN}/_next/static/chunks/0abc.js`

const frame = (filename: string): StackFrame => ({ filename, lineno: 1, colno: 1 })

/** The tags the integration leaves on an error with these stacks, one per exception. */
function tagsFor(...stacks: (StackFrame[] | undefined)[]): Event["tags"] {
  const event: Event = {
    exception: {
      values: stacks.map((frames) => ({
        type: "Error",
        value: "boom",
        stacktrace: frames && { frames },
      })),
    },
  }
  thirdPartyFramesIntegration({ origin: ORIGIN }).preprocessEvent?.(event, {}, undefined as never)
  return event.tags
}

describe("isOurChunk", () => {
  it.each([
    [OURS, true],
    [`${ORIGIN}/_next/static/chunks/app/page-1.js?dpl=abc`, true],
    [`${ORIGIN}/cdn-cgi/rum?v=1`, false],
    [`${ORIGIN}/volumes/3`, false],
    ["https://other.test/_next/static/chunks/0abc.js", false],
    ["chrome-extension://abc/content.js", false],
    ["app:///_next/static/chunks/0abc.js", false],
    ["<anonymous>", false],
    ["", false],
  ])("%s → %s", (filename, ours) => {
    expect(isOurChunk(filename, { origin: ORIGIN })).toBe(ours)
  })
})

describe("thirdPartyFramesIntegration", () => {
  it("leaves an error with a frame in our chunks untagged", () => {
    expect(tagsFor([frame("chrome-extension://abc/content.js"), frame(OURS)])).toBeUndefined()
  })

  it("leaves an error untagged when one of its chained exceptions has a frame of ours", () => {
    expect(tagsFor([frame(`${ORIGIN}/cdn-cgi/rum`)], [frame(OURS)])).toBeUndefined()
  })

  it.each([
    ["Cloudflare's beacon", `${ORIGIN}/cdn-cgi/rum?v=1`],
    ["an inline script", `${ORIGIN}/volumes/3`],
    ["another origin", "https://ads.example/tag.js"],
    ["an extension", "chrome-extension://abc/content.js"],
  ])("tags an error only from %s, keeping its other tags", (_, filename) => {
    const event: Event = {
      tags: { pr: "1" },
      exception: { values: [{ stacktrace: { frames: [frame(filename)] } }] },
    }
    thirdPartyFramesIntegration({ origin: ORIGIN }).preprocessEvent?.(event, {}, undefined as never)
    expect(event.tags).toEqual({ pr: "1", third_party_code: true })
  })

  it("ignores frames without a file or a position, as Sentry's filter does", () => {
    expect(tagsFor([{ filename: OURS }, frame("https://ads.example/tag.js")])).toEqual({
      third_party_code: true,
    })
  })

  it("judges nothing without a stack", () => {
    expect(tagsFor(undefined)).toBeUndefined()
    const message: Event = { message: "MathJax failed to load" }
    thirdPartyFramesIntegration({ origin: ORIGIN }).preprocessEvent?.(
      message,
      {},
      undefined as never,
    )
    expect(message.tags).toBeUndefined()
  })
})
