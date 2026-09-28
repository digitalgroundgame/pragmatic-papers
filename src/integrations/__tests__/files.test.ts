import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { githubFileSource } from "../github/contents"
import { localFileSource, memoryFileSource } from "../files"

function stubFetch(status: number, body: string): typeof fetch {
  return vi.fn(async () => ({
    ok: status < 400,
    status,
    text: async () => body,
  })) as unknown as typeof fetch
}

describe("githubFileSource", () => {
  it("asks the contents API for raw bytes at the ref, with the token", async () => {
    const fetchImpl = stubFetch(200, '{"version":"abc"}')
    const src = githubFileSource({ repo: "org/repo", ref: "v1.2", token: "ghp_x", fetchImpl })
    await expect(src.readJson<{ version: string }>("data/manifest.json")).resolves.toEqual({
      version: "abc",
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/repos/org/repo/contents/data/manifest.json?ref=v1.2",
      {
        headers: {
          Accept: "application/vnd.github.raw+json",
          "X-GitHub-Api-Version": "2022-11-28",
          Authorization: "Bearer ghp_x",
        },
      },
    )
    expect(src.describe()).toBe("github:org/repo@v1.2")
  })

  it("sends no Authorization header without a token and encodes path segments", async () => {
    const fetchImpl = stubFetch(200, "[]")
    const src = githubFileSource({ repo: "org/repo", ref: "main", fetchImpl })
    await src.read("data/judges/ca 8.json")
    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]!
    expect(url).toBe(
      "https://api.github.com/repos/org/repo/contents/data/judges/ca%208.json?ref=main",
    )
    expect(init.headers).not.toHaveProperty("Authorization")
  })

  it("names the source, path and status when a read fails", async () => {
    const src = githubFileSource({ repo: "org/repo", ref: "main", fetchImpl: stubFetch(404, "") })
    await expect(src.read("data/courts.json")).rejects.toThrow(
      "github:org/repo@main data/courts.json: HTTP 404",
    )
  })

  it("reports invalid JSON with the path", async () => {
    const src = githubFileSource({
      repo: "org/repo",
      ref: "main",
      fetchImpl: stubFetch(200, "{nope"),
    })
    await expect(src.readJson("data/courts.json")).rejects.toThrow(
      /github:org\/repo@main data\/courts.json: not valid JSON/,
    )
  })
})

describe("localFileSource", () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "file-source-"))
    await mkdir(join(dir, "data"))
    await writeFile(join(dir, "data", "manifest.json"), '{"version":"abc"}')
    await writeFile(join(dir, "data", "broken.json"), "{nope")
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it("reads paths relative to the checkout", async () => {
    const src = localFileSource(dir)
    expect(src.describe()).toBe(`dir:${dir}`)
    await expect(src.readJson("data/manifest.json")).resolves.toEqual({ version: "abc" })
  })

  it("names the checkout and path when a file is not JSON or not there", async () => {
    const src = localFileSource(dir)
    await expect(src.readJson("data/broken.json")).rejects.toThrow(
      `dir:${dir} data/broken.json: not valid JSON`,
    )
    await expect(src.read("data/missing.json")).rejects.toThrow(/ENOENT/)
  })
})

describe("memoryFileSource", () => {
  it("serves strings and objects and fails on unknown paths", async () => {
    const src = memoryFileSource({ "a.json": { x: 1 }, "b.txt": "hi" })
    await expect(src.readJson("a.json")).resolves.toEqual({ x: 1 })
    await expect(src.read("b.txt")).resolves.toBe("hi")
    await expect(src.read("c")).rejects.toThrow("memory c: not found")
  })
})
