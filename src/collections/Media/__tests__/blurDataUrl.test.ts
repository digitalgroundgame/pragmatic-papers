// @vitest-environment node
import { mkdtemp, rm, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import sharp from "sharp"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { blurDataUrl } from "../blurDataUrl"

let dir: string
let image: Buffer

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "blur-data-url-"))
  image = await sharp({
    create: { width: 40, height: 20, channels: 3, background: { r: 255, g: 64, b: 26 } },
  })
    .jpeg()
    .toBuffer()
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

const decode = (url: string) =>
  sharp(Buffer.from(url.replace("data:image/png;base64,", ""), "base64")).metadata()

describe("blurDataUrl", () => {
  it("makes a tiny PNG placeholder from an image's bytes", async () => {
    const url = await blurDataUrl(image)

    expect(url).toMatch(/^data:image\/png;base64,/)
    expect(await decode(url)).toMatchObject({ format: "png", width: 10, height: 5 })
  })

  it("reads the image from a file path", async () => {
    const file = path.join(dir, "upload")
    await writeFile(file, image)

    expect(await blurDataUrl(file)).toBe(await blurDataUrl(image))
  })

  it("rejects an empty buffer", async () => {
    await expect(blurDataUrl(Buffer.alloc(0))).rejects.toThrow(/empty/i)
  })
})
