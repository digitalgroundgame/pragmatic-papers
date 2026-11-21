// @vitest-environment node
import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { interactiveMapBlock } from "@/stories/fixtures/blocks"

import { interactiveMapToSVG } from "../converters"
import { renderMapImage } from "../renderImage"

const SQUARE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g><path id="A" data-margin="40" d="M0 0H10V10H0Z"/></g></svg>`

describe("renderMapImage", () => {
  it("rasterizes the block's SVG as a PNG twice the drawing's size", async () => {
    const svg = interactiveMapToSVG({
      ...interactiveMapBlock,
      widgetTitle: null,
      colorScale: "perRegion",
      maps: [
        {
          svgAsset: { id: 1, svgContent: SQUARE, createdAt: "", updatedAt: "" },
          overrides: [{ regionId: "A", color: "#126ace" }],
        },
      ],
    })!

    const png = await renderMapImage(svg)
    const image = sharp(png)
    const { format, width, height } = await image.metadata()
    // A 648-unit square map inside 16 units of padding, at two pixels a unit.
    expect({ format, width, height }).toEqual({ format: "png", width: 1360, height: 1360 })

    // The middle of the map is the region's color, and the corner the white page.
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
    const pixel = (x: number, y: number) => [
      ...data.subarray((y * info.width + x) * info.channels).subarray(0, 3),
    ]
    expect(pixel(680, 680)).toEqual([0x12, 0x6a, 0xce])
    expect(pixel(4, 4)).toEqual([255, 255, 255])
  })
})
