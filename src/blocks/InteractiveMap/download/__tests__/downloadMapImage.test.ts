import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { fontFaces, logoMarkup, mapFileName, saveSVGAsPNG } from "../downloadMapImage"

describe("mapFileName", () => {
  it.each([
    ["Districts & margins", "districts-margins.png"],
    ["Missouri's 2026 map — before/after", "missouris-2026-map-beforeafter.png"],
    ["  Señor   Café  ", "senor-cafe.png"],
    ["", "map.png"],
    [null, "map.png"],
    ["!!!", "map.png"],
  ])("names %j as %s", (title, name) => {
    expect(mapFileName(title)).toBe(name)
  })
})

describe("logoMarkup", () => {
  it("is nothing without a logo", () => {
    expect(logoMarkup(null, "#111")).toBeUndefined()
  })

  it("copies the logo in the ink, keeping the color the page gave its classed parts", () => {
    document.body.innerHTML =
      '<svg viewBox="0 0 10 2" class="h-4"><path class="fill-brand" style="fill: rgb(255, 0, 0)" d="M0 0"/><path d="M1 1"/></svg>'
    const markup = logoMarkup(document.querySelector("svg"), "#111")!
    expect(markup).toContain('fill="#111"')
    expect(markup).not.toContain("class=")
    expect(markup).toContain('viewBox="0 0 10 2"')
    expect(markup.match(/<path/g)).toHaveLength(2)
  })
})

describe("fontFaces", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("inlines each font it can fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))),
    )
    const css = (await fontFaces())!
    expect(css.match(/@font-face/g)).toHaveLength(3)
    expect(css).toContain('font-family:"Geist"')
    expect(css).toContain("src:url(data:font/woff2;base64,AQID)")
  })

  it("is nothing when no font loads", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockRejectedValue(new Error("offline")),
    )
    await expect(fontFaces()).resolves.toBeUndefined()
  })
})

describe("saveSVGAsPNG", () => {
  const urls = { created: [] as Blob[], revoked: [] as string[] }
  let clicked: HTMLAnchorElement[] = []
  let load: "ok" | "fail" = "ok"
  let png: Blob | null = new Blob(["png"], { type: "image/png" })

  beforeEach(() => {
    urls.created = []
    urls.revoked = []
    clicked = []
    load = "ok"
    png = new Blob(["png"], { type: "image/png" })
    vi.stubGlobal("URL", {
      createObjectURL: (blob: Blob) => `blob:${urls.created.push(blob)}`,
      revokeObjectURL: (url: string) => void urls.revoked.push(url),
    })
    // An image that "loads" as soon as it is given a source.
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 1200
        naturalHeight = 600
        onload?: () => void
        onerror?: () => void
        set src(_url: string) {
          queueMicrotask(() => (load === "ok" ? this.onload?.() : this.onerror?.()))
        }
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => done(png))
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this)
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("draws the SVG at its own size and downloads it under the name", async () => {
    await saveSVGAsPNG("<svg/>", "count.png")
    expect(urls.created[0]!.type).toBe("image/svg+xml")
    expect(clicked).toHaveLength(1)
    expect(clicked[0]!.download).toBe("count.png")
    expect(clicked[0]!.getAttribute("href")).toBe("blob:2")
    // The SVG's address is released at once; the PNG's stays while the download starts.
    expect(urls.revoked).toEqual(["blob:1"])
  })

  it("fails, releasing the SVG, when the picture won't load or can't be encoded", async () => {
    load = "fail"
    await expect(saveSVGAsPNG("<svg/>", "count.png")).rejects.toThrow("did not load")
    load = "ok"
    png = null
    await expect(saveSVGAsPNG("<svg/>", "count.png")).rejects.toThrow("could not be saved")
    expect(clicked).toHaveLength(0)
    expect(urls.revoked).toEqual(["blob:1", "blob:2"])
  })
})
