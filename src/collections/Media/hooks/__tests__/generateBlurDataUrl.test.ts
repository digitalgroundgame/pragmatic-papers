// @vitest-environment node
import type { Media } from "@/payload-types"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/utilities/getBlurDataUrlFromBuffer", () => ({ getBlurDataUrlFromBuffer: vi.fn() }))

const { getBlurDataUrlFromBuffer } = await import("@/utilities/getBlurDataUrlFromBuffer")
const { generateBlurDataUrl } = await import("../generateBlurDataUrl")

const logger = { info: vi.fn(), error: vi.fn() }

const run = (file?: { name: string; mimetype?: string; data: Buffer }) =>
  generateBlurDataUrl({
    data: { alt: "x" },
    req: { file, payload: { logger } },
  } as never) as Promise<Partial<Media>>

afterEach(() => {
  vi.clearAllMocks()
})

describe("generateBlurDataUrl", () => {
  it("adds a blur placeholder for an uploaded image", async () => {
    vi.mocked(getBlurDataUrlFromBuffer).mockResolvedValue("data:image/png;base64,abc")
    const data = Buffer.from("png")

    const result = await run({ name: "photo.png", mimetype: "image/png", data })

    expect(getBlurDataUrlFromBuffer).toHaveBeenCalledWith(data)
    expect(result).toEqual({ alt: "x", blurDataURL: "data:image/png;base64,abc" })
  })

  it("skips requests without a file and files that aren't images", async () => {
    await expect(run()).resolves.toEqual({ alt: "x" })
    await expect(
      run({ name: "doc.pdf", mimetype: "application/pdf", data: Buffer.from("") }),
    ).resolves.toEqual({ alt: "x" })
    await expect(run({ name: "unknown", data: Buffer.from("") })).resolves.toEqual({ alt: "x" })
    expect(getBlurDataUrlFromBuffer).not.toHaveBeenCalled()
  })

  it("logs and still saves when the placeholder can't be generated", async () => {
    vi.mocked(getBlurDataUrlFromBuffer).mockRejectedValue(new Error("corrupt image"))

    const result = await run({ name: "bad.jpg", mimetype: "image/jpeg", data: Buffer.from("") })

    expect(result).toEqual({ alt: "x" })
    expect(logger.error).toHaveBeenCalledWith("Failed to generate blur data URL: corrupt image")
  })
})
