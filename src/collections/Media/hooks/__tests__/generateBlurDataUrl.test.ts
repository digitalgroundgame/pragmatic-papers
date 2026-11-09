// @vitest-environment node
import type { Media } from "@/payload-types"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/collections/Media/blurDataUrl", () => ({ blurDataUrl: vi.fn() }))

const { blurDataUrl } = await import("@/collections/Media/blurDataUrl")
const { generateBlurDataUrl } = await import("../generateBlurDataUrl")

const logger = { info: vi.fn(), error: vi.fn() }

const run = (file?: { name: string; mimetype?: string; data: Buffer; tempFilePath?: string }) =>
  generateBlurDataUrl({
    data: { alt: "x" },
    req: { file, payload: { logger } },
  } as never) as Promise<Partial<Media>>

afterEach(() => {
  vi.clearAllMocks()
})

describe("generateBlurDataUrl", () => {
  it("adds a blur placeholder for an uploaded image", async () => {
    vi.mocked(blurDataUrl).mockResolvedValue("data:image/png;base64,abc")
    const data = Buffer.from("png")

    const result = await run({ name: "photo.png", mimetype: "image/png", data })

    expect(blurDataUrl).toHaveBeenCalledWith(data)
    expect(result).toEqual({ alt: "x", blurDataURL: "data:image/png;base64,abc" })
  })

  it("skips requests without a file and files that aren't images", async () => {
    await expect(run()).resolves.toEqual({ alt: "x" })
    await expect(
      run({ name: "doc.pdf", mimetype: "application/pdf", data: Buffer.from("") }),
    ).resolves.toEqual({ alt: "x" })
    await expect(run({ name: "unknown", data: Buffer.from("") })).resolves.toEqual({ alt: "x" })
    expect(blurDataUrl).not.toHaveBeenCalled()
  })

  it("logs and still saves when the placeholder can't be generated", async () => {
    vi.mocked(blurDataUrl).mockRejectedValue(new Error("corrupt image"))

    const result = await run({ name: "bad.jpg", mimetype: "image/jpeg", data: Buffer.from("x") })

    expect(result).toEqual({ alt: "x" })
    expect(logger.error).toHaveBeenCalledWith("Failed to generate blur data URL: corrupt image")
  })

  it("reads a browser upload from the temp file Payload downloaded it to", async () => {
    vi.mocked(blurDataUrl).mockResolvedValue("data:image/png;base64,abc")

    const result = await run({
      name: "photo.jpg",
      mimetype: "image/jpeg",
      data: Buffer.alloc(0),
      tempFilePath: "/tmp/payload-client-upload-1",
    })

    expect(blurDataUrl).toHaveBeenCalledWith("/tmp/payload-client-upload-1")
    expect(result).toEqual({ alt: "x", blurDataURL: "data:image/png;base64,abc" })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it("skips quietly when the upload carries no bytes and no temp file", async () => {
    const result = await run({ name: "photo.jpg", mimetype: "image/jpeg", data: Buffer.alloc(0) })

    expect(result).toEqual({ alt: "x" })
    expect(blurDataUrl).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })
})
