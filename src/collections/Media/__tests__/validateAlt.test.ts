import type { PayloadRequest } from "payload"
import { describe, expect, it } from "vitest"

import { validateAlt } from "../validateAlt"

const editor = { user: { id: 1 } } as unknown as PayloadRequest
const script = {} as PayloadRequest
const MESSAGE = "Describe the image for readers who can't see it."

function check(
  value: string | null | undefined,
  {
    mimeType = "image/png",
    id,
    previousValue,
    req = editor,
  }: { mimeType?: string; id?: number; previousValue?: string | null; req?: PayloadRequest } = {},
) {
  return validateAlt(value, {
    data: { mimeType },
    id,
    previousValue,
    req,
  } as unknown as Parameters<typeof validateAlt>[1])
}

describe("validateAlt", () => {
  it("requires alt text when an editor uploads an image", () => {
    expect(check(undefined)).toBe(MESSAGE)
    expect(check("   ")).toBe(MESSAGE)
    expect(check("A lighthouse at dusk")).toBe(true)
  })

  it("leaves audio and video to their captions", () => {
    expect(check(undefined, { mimeType: "audio/mpeg" })).toBe(true)
    expect(check(undefined, { mimeType: "video/mp4" })).toBe(true)
  })

  it("lets scripts without a user copy what they were given", () => {
    expect(check("", { req: script })).toBe(true)
  })

  it("lets an image uploaded without alt text be edited without adding it", () => {
    expect(check(null, { id: 7, previousValue: null })).toBe(true)
  })

  it("won't clear alt text that was written", () => {
    expect(check("", { id: 7, previousValue: "A lighthouse at dusk" })).toBe(MESSAGE)
  })
})
