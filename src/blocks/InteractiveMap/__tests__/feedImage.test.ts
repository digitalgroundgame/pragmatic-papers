// @vitest-environment node
import type { Payload, PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { InteractiveMapBlock, MapAsset, Media } from "@/payload-types"

vi.mock("../renderImage", () => ({ renderMapImage: vi.fn(async () => Buffer.from("png")) }))

const { attachMapImages, generateMapImages, mapBlocksIn, mapImageKey } =
  await import("../feedImage")
const { renderMapImage } = await import("../renderImage")

const SVG = `<svg viewBox="0 0 10 10"><g><path id="A" data-margin="40" d="M0 0H10V10H0Z"/></g></svg>`

const asset = (id: number, svgContent = SVG): MapAsset => ({
  id,
  svgContent,
  createdAt: "",
  updatedAt: "",
})

const mapBlock = (overrides: Partial<InteractiveMapBlock> = {}): InteractiveMapBlock => ({
  blockType: "interactiveMap",
  widgetTitle: "Turnout",
  layout: "row",
  colorScale: "divergingRedBlue",
  maps: [{ title: "2024", svgAsset: asset(1), dataAttribute: "data-margin" }],
  ...overrides,
})

const content = (...blocks: object[]) => ({
  root: {
    type: "root",
    children: [
      { type: "paragraph", children: [{ type: "text", text: "Before" }] },
      ...blocks.map((fields) => ({ type: "block", fields })),
    ],
  },
})

const image = (key: string, id = 1): Media =>
  ({
    id,
    filename: `interactive-map-${key}.webp`,
    url: `/media/interactive-map-${key}.webp`,
  }) as Media

describe("mapBlocksIn", () => {
  it("finds the map blocks, at any depth, and nothing else", () => {
    const map = mapBlock()
    const nested = mapBlock({ widgetTitle: "Nested" })
    const value = content({ blockType: "banner" }, map)
    value.root.children.push({
      type: "quote",
      children: [{ type: "block", fields: nested }],
    } as never)

    expect(mapBlocksIn(value)).toEqual([map, nested])
  })

  it.each([null, undefined, "text", {}, { root: null }])("finds none in %o", (value) => {
    expect(mapBlocksIn(value)).toEqual([])
  })
})

describe("mapImageKey", () => {
  it("is the same for the same map, whatever else the block and asset carry", () => {
    const key = mapImageKey(mapBlock())
    expect(key).toMatch(/^[0-9a-f]{16}$/)
    expect(
      mapImageKey(
        mapBlock({
          id: "another-block",
          sources: [{ link: { type: "custom", url: "https://example.com", label: "Source" } }],
          maps: [
            {
              id: "row",
              title: "2024",
              svgAsset: { ...asset(22), label: "Renamed" },
              dataAttribute: "data-margin",
              invertColors: false,
              overrides: [],
            },
          ],
        }),
      ),
    ).toBe(key)
  })

  it.each<[string, Partial<InteractiveMapBlock>]>([
    ["title", { widgetTitle: "Turnout, revised" }],
    ["layout", { layout: "stacked" }],
    ["color scale", { colorScale: "perRegion" }],
    ["color bias", { colorBias: 4 }],
    [
      "map's title",
      { maps: [{ title: "2026", svgAsset: asset(1), dataAttribute: "data-margin" }] },
    ],
    ["map's SVG", { maps: [{ title: "2024", svgAsset: asset(1, SVG.replace("40", "41")) }] }],
    ["map's data attribute", { maps: [{ title: "2024", svgAsset: asset(1) }] }],
    [
      "map's inversion",
      {
        maps: [
          { title: "2024", svgAsset: asset(1), dataAttribute: "data-margin", invertColors: true },
        ],
      },
    ],
    [
      "map's overrides",
      {
        maps: [
          {
            title: "2024",
            svgAsset: asset(1),
            dataAttribute: "data-margin",
            overrides: [{ regionId: "A", value: 3 }],
          },
        ],
      },
    ],
  ])("changes with the %s", (_label, change) => {
    expect(mapImageKey(mapBlock(change))).not.toBe(mapImageKey(mapBlock()))
  })

  it("is null when no map has its SVG loaded", () => {
    expect(mapImageKey(mapBlock({ maps: [{ svgAsset: 1 }] }))).toBeNull()
    expect(mapImageKey(mapBlock({ maps: [{ svgAsset: asset(1, "") }] }))).toBeNull()
    expect(mapImageKey(mapBlock({ maps: [] }))).toBeNull()
  })
})

describe("attachMapImages", () => {
  it("gives each map block its stored picture with one lookup, and null without one", async () => {
    const drawn = mapBlock()
    const undrawn = mapBlock({ widgetTitle: "Not drawn yet" })
    const unloaded = mapBlock({ maps: [{ svgAsset: 1 }] })
    const key = mapImageKey(drawn)!
    const stored = image(key)
    const find = vi.fn(async () => ({ docs: [stored] }))

    await attachMapImages({ find } as unknown as Payload, [
      { content: content(drawn) },
      { content: content(undrawn, unloaded) },
      {},
    ])

    expect(drawn).toHaveProperty("feedImage", stored)
    expect(undrawn).toHaveProperty("feedImage", null)
    expect(unloaded).toHaveProperty("feedImage", null)
    expect(find).toHaveBeenCalledTimes(1)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "media",
        where: {
          or: [
            { filename: { contains: `interactive-map-${key}` } },
            { filename: { contains: `interactive-map-${mapImageKey(undrawn)}` } },
          ],
        },
      }),
    )
  })

  it("doesn't query when there are no maps", async () => {
    const find = vi.fn()
    await attachMapImages({ find } as unknown as Payload, [{ content: content() }])
    expect(find).not.toHaveBeenCalled()
  })

  it("takes the older of two pictures with one key", async () => {
    const block = mapBlock()
    const key = mapImageKey(block)!
    const older = image(key, 1)
    // Newest first, as the query sorts them; a second save's copy got a "-1" suffix.
    const newer = { ...image(key, 2), filename: `interactive-map-${key}-1.webp` }
    const find = vi.fn(async () => ({ docs: [newer, older] }))

    await attachMapImages({ find } as unknown as Payload, [{ content: content(block) }])

    expect(block).toHaveProperty("feedImage", older)
  })
})

describe("generateMapImages", () => {
  const user = { id: 5 }
  let find: ReturnType<typeof vi.fn>
  let create: ReturnType<typeof vi.fn>
  let req: PayloadRequest
  let storedImages: Media[]

  beforeEach(() => {
    vi.mocked(renderMapImage).mockClear()
    storedImages = []
    find = vi.fn(async ({ collection }: { collection: string }) =>
      collection === "map-assets" ? { docs: [asset(1)] } : { docs: storedImages },
    )
    create = vi.fn(async () => ({}))
    req = { payload: { find, create }, user } as unknown as PayloadRequest
  })

  it("loads the maps' assets, draws the block and stores the picture as the saving user", async () => {
    const stored = mapBlock({
      maps: [{ title: "2024", svgAsset: 1, dataAttribute: "data-margin" }],
    })

    await generateMapImages({ blocks: [stored], req })

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "map-assets", where: { id: { in: [1] } }, req }),
    )
    expect(renderMapImage).toHaveBeenCalledTimes(1)
    expect(vi.mocked(renderMapImage).mock.calls[0]![0]).toContain(">Turnout</text>")
    expect(create).toHaveBeenCalledTimes(1)
    const args = create.mock.calls[0]![0]
    expect(args).toMatchObject({
      collection: "media",
      data: { alt: "Map: Turnout" },
      file: {
        name: `interactive-map-${mapImageKey(mapBlock())}.png`,
        mimetype: "image/png",
        size: 3,
      },
      user,
    })
    // Its own transaction: a failed upload mustn't abort the save that asked for it.
    expect(args).not.toHaveProperty("req")
  })

  it("draws nothing for a block whose picture is stored", async () => {
    storedImages = [image(mapImageKey(mapBlock())!)]

    await generateMapImages({ blocks: [mapBlock()], req })

    expect(renderMapImage).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it("draws two blocks showing the same map once", async () => {
    await generateMapImages({ blocks: [mapBlock(), mapBlock({ id: "copy" })], req })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("uses an asset it was handed instead of loading it", async () => {
    const replaced = asset(1, SVG.replace("40", "-40"))

    await generateMapImages({
      blocks: [mapBlock({ maps: [{ svgAsset: 1, dataAttribute: "data-margin" }] })],
      req,
      assets: [replaced],
    })

    expect(find).not.toHaveBeenCalledWith(expect.objectContaining({ collection: "map-assets" }))
    expect(create.mock.calls[0]![0].file.name).toBe(
      `interactive-map-${mapImageKey(mapBlock({ maps: [{ svgAsset: replaced, dataAttribute: "data-margin" }] }))}.png`,
    )
  })

  it("does nothing without blocks, or for a block whose maps have no SVG", async () => {
    await generateMapImages({ blocks: [], req })
    expect(find).not.toHaveBeenCalled()

    find.mockImplementation(async () => ({ docs: [] }))
    await generateMapImages({ blocks: [mapBlock({ maps: [{ svgAsset: 404 }] })], req })
    expect(create).not.toHaveBeenCalled()
  })
})
