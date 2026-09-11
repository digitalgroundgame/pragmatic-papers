import { gzipSync } from "node:zlib"

import { describe, expect, it, vi } from "vitest"

import { gunzip, readTar, tarFileSource } from "../archive"
import { releaseTarballSource } from "../github/releases"
import { tarArchive as archive, tarEntry as entry, tarGz } from "./tarFixture"

describe("readTar", () => {
  it("reads every regular file, whatever its size lands on a block boundary", () => {
    const files = readTar(
      archive(
        entry("data/manifest.json", '{"version":"abc"}'),
        entry("data/a.json", "x".repeat(600)),
      ),
    )
    expect([...files.keys()]).toEqual(["data/manifest.json", "data/a.json"])
    expect(new TextDecoder().decode(files.get("data/a.json"))).toBe("x".repeat(600))
  })

  it("joins ustar's split path, and takes a GNU long name from the entry before it", () => {
    const long = `data/judges/${"d".repeat(120)}.json`
    const files = readTar(
      archive(
        entry("judges/ca9.json", "[]", { prefix: "data" }),
        entry("././@LongLink", long, { type: "L" }),
        entry("data/truncated.json", "[1]"),
      ),
    )
    expect([...files.keys()]).toEqual(["data/judges/ca9.json", long])
  })

  it("skips what a consumer never asks for: directories, links and PAX records", () => {
    const files = readTar(
      archive(
        entry("data/", "", { type: "5" }),
        entry("PaxHeaders/x", "30 mtime=1700000000.0\n", { type: "x" }),
        entry("data/courts.json", "[]"),
      ),
    )
    expect([...files.keys()]).toEqual(["data/courts.json"])
  })

  it("stops at the end-of-archive padding rather than reading it as a file", () => {
    const files = readTar(archive(entry("data/courts.json", "[]")))
    expect(files.size).toBe(1)
  })
})

describe("tarFileSource", () => {
  it("serves files out of the archive and names what is missing", async () => {
    const src = tarFileSource(
      "release data-json.tar.gz",
      readTar(archive(entry("data/c.json", '{"a":1}'))),
    )
    await expect(src.readJson("data/c.json")).resolves.toEqual({ a: 1 })
    await expect(src.read("data/gone.json")).rejects.toThrow(
      /release data-json\.tar\.gz data\/gone\.json: not in the archive \(1 files\)/,
    )
  })
})

describe("releaseTarballSource", () => {
  const gz = (): ArrayBuffer => tarGz({ "data/manifest.json": { version: "v1" } })

  it("downloads the asset through the API url with the token, and serves its files", async () => {
    const fetchImpl = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(gz(), { status: 200 }),
    )
    const src = await releaseTarballSource({
      label: "github:o/r@data-v1 data-json.tar.gz",
      url: "https://api.github.com/repos/o/r/releases/assets/7",
      token: "t0ken",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(src.readJson("data/manifest.json")).resolves.toEqual({ version: "v1" })
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe("https://api.github.com/repos/o/r/releases/assets/7")
    // The API url with octet-stream is what works on a private repo; the browser url does not.
    expect(init?.headers).toMatchObject({
      Accept: "application/octet-stream",
      Authorization: "Bearer t0ken",
    })
  })

  it("names the release when the download fails", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 404 }))
    await expect(
      releaseTarballSource({
        label: "github:o/r@data-v1 data-json.tar.gz",
        url: "https://api.github.com/repos/o/r/releases/assets/7",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow("github:o/r@data-v1 data-json.tar.gz: HTTP 404")
  })

  it("gunzips through the platform decompressor", async () => {
    const round = await gunzip(new Uint8Array(gzipSync(Buffer.from("hello"))))
    expect(new TextDecoder().decode(round)).toBe("hello")
  })
})
