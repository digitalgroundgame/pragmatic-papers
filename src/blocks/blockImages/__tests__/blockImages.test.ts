// @vitest-environment node
import { describe, expect, it } from "vitest"

import { GET, generateStaticParams } from "@/app/(payload)/admin/block-images/[file]/route"

import { BLOCK_IMAGES_PATH, blockImages } from ".."
import { BLOCKS } from "@/blocks/registry"

const SLUGS = BLOCKS.map(({ slug }) => slug)

// Whether every block has images is `registry.test.ts`'s check; this one checks the route.
const get = (file: string) =>
  GET(new Request(`http://localhost${BLOCK_IMAGES_PATH}/${file}`), {
    params: Promise.resolve({ file }),
  })

describe("/admin/block-images/[file]", () => {
  it("prerenders a thumbnail and an icon for every block", async () => {
    const files = (await generateStaticParams()).map(({ file }) => file).sort()
    const expected = SLUGS.flatMap((slug) => [`${slug}.svg`, `${slug}-icon.svg`])
    expect(files).toEqual(expected.sort())
  })

  it.each(SLUGS)("serves %s at the sizes Payload expects", async (slug) => {
    const thumbnail = await get(`${slug}.svg`)
    expect(thumbnail.status).toBe(200)
    expect(thumbnail.headers.get("Content-Type")).toBe("image/svg+xml; charset=utf-8")
    // The drawer wants 3:2 thumbnails; the editor's menus show icons at 20×20.
    expect(await thumbnail.text()).toMatch(/^<svg [^>]*viewBox="0 0 480 320"/)
    expect(await (await get(`${slug}-icon.svg`)).text()).toMatch(/^<svg [^>]*viewBox="0 0 24 24"/)
  })

  it("answers 404 for a block it doesn't draw", async () => {
    expect((await get("nope.svg")).status).toBe(404)
  })

  it("points each block's images at it, marked decorative since the label sits beside them", () => {
    expect(blockImages("banner")).toEqual({
      icon: { url: "/admin/block-images/banner-icon.svg", alt: "" },
      thumbnail: { url: "/admin/block-images/banner.svg", alt: "" },
    })
  })
})
