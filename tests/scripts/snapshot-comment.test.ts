import { Readable } from "node:stream"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { buildCommentBody, main, readStdin } from "../../scripts/snapshot-comment"

const BASE = "https://raw.githubusercontent.com/org/repo/pr-screenshots/1/abc"

describe("buildCommentBody", () => {
  it("includes the fingerprint marker", () => {
    const body = buildCommentBody({ fingerprint: "deadbeef", baseUrl: BASE, paths: [] })
    expect(body).toContain("<!-- screenshots:deadbeef -->")
  })

  it("includes the section heading", () => {
    const body = buildCommentBody({ fingerprint: "", baseUrl: BASE, paths: [] })
    expect(body).toContain("## Snapshot updates in this PR")
  })

  it("produces an empty table for zero paths", () => {
    const body = buildCommentBody({ fingerprint: "", baseUrl: BASE, paths: [] })
    expect(body).toContain("<table></table>")
  })

  it("renders a single image in a half row with a trailing empty cell", () => {
    const body = buildCommentBody({
      fingerprint: "",
      baseUrl: BASE,
      paths: ["a/__screenshots__/button.png"],
    })
    expect(body).toContain(`<img src="${BASE}/button.png" alt="button" width="100%"/>`)
    expect(body).toContain("<td></td>")
    // exactly one row
    expect(body.match(/<tr>/g)).toHaveLength(1)
  })

  it("fills a complete row for exactly two images", () => {
    const body = buildCommentBody({
      fingerprint: "",
      baseUrl: BASE,
      paths: ["__screenshots__/a.png", "__screenshots__/b.png"],
    })
    expect(body).toContain(`alt="a"`)
    expect(body).toContain(`alt="b"`)
    expect(body).not.toContain("<td></td>")
    expect(body.match(/<tr>/g)).toHaveLength(1)
  })

  it("uses two rows for three images, with a trailing empty cell in the second", () => {
    const body = buildCommentBody({
      fingerprint: "",
      baseUrl: BASE,
      paths: ["x.png", "y.png", "z.png"],
    })
    expect(body.match(/<tr>/g)).toHaveLength(2)
    expect(body.match(/<td><\/td>/g)).toHaveLength(1)
  })

  it("uses two full rows for four images with no empty cells", () => {
    const body = buildCommentBody({
      fingerprint: "",
      baseUrl: BASE,
      paths: ["a.png", "b.png", "c.png", "d.png"],
    })
    expect(body.match(/<tr>/g)).toHaveLength(2)
    expect(body).not.toContain("<td></td>")
  })

  it("strips a trailing slash from baseUrl", () => {
    const body = buildCommentBody({
      fingerprint: "",
      baseUrl: BASE + "/",
      paths: ["img.png"],
    })
    expect(body).toContain(`src="${BASE}/img.png"`)
  })

  it("derives the image name from the basename, stripping directory and .png", () => {
    const body = buildCommentBody({
      fingerprint: "",
      baseUrl: BASE,
      paths: ["deeply/nested/__screenshots__/my-component.png"],
    })
    expect(body).toContain(`src="${BASE}/my-component.png"`)
    expect(body).toContain(`alt="my-component"`)
  })
})

describe("readStdin", () => {
  it("reads all chunks from a stream and returns them as a string", async () => {
    const stream = Readable.from([Buffer.from("hello\n"), Buffer.from("world")])
    const result = await readStdin(stream)
    expect(result).toBe("hello\nworld")
  })
})

describe("main", () => {
  let write: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    write = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
  })

  afterEach(() => {
    write.mockRestore()
    delete process.env.FINGERPRINT
    delete process.env.ASSET_BASE_URL
  })

  it("writes a comment body using FINGERPRINT and ASSET_BASE_URL env vars", async () => {
    process.env.FINGERPRINT = "cafe1234"
    process.env.ASSET_BASE_URL = BASE
    const readInput = vi.fn().mockResolvedValue("a.png\nb.png\n")

    await main(readInput)

    const output = write.mock.calls[0][0] as string
    expect(output).toContain("<!-- screenshots:cafe1234 -->")
    expect(output).toContain(`src="${BASE}/a.png"`)
    expect(output).toContain(`src="${BASE}/b.png"`)
  })

  it("falls back to empty fingerprint and baseUrl when env vars are absent", async () => {
    const readInput = vi.fn().mockResolvedValue("img.png\n")

    await main(readInput)

    const output = write.mock.calls[0][0] as string
    expect(output).toContain("<!-- screenshots: -->")
    expect(output).toContain(`src="/img.png"`)
  })

  it("ignores blank lines in stdin", async () => {
    process.env.FINGERPRINT = "abc"
    process.env.ASSET_BASE_URL = BASE
    const readInput = vi.fn().mockResolvedValue("a.png\n\n  \nb.png\n")

    await main(readInput)

    const output = write.mock.calls[0][0] as string
    expect(output.match(/<img/g)).toHaveLength(2)
  })
})
