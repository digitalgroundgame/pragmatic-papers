import { randomUUID } from "node:crypto"
import type { Article, MapAsset, Media, User } from "@/payload-types"
import type { Payload } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

import { substackArticleHTML } from "@/app/(frontend)/articles/_substack/generateSubstackFeed"
import { querySyndicatedArticleBySlug } from "@/app/(frontend)/articles/_substack/queries"
import { createUser, getPayload } from "./helpers/testUsers"

let payload: Payload
let editor: User

const svg = (margin: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><g>` +
  `<path id="A" data-label="District A" data-margin="${margin}" d="M0 0H100V100H0Z"/>` +
  `<path id="B" data-label="District B" data-margin="-12" d="M100 0H200V100H100Z"/>` +
  `</g></svg>`

const svgFile = (margin: number) => {
  const data = Buffer.from(svg(margin))
  // Unique: every test file shares public/media (see fixtures/media.ts).
  return {
    name: `districts-${randomUUID()}.svg`,
    data,
    mimetype: "image/svg+xml",
    size: data.byteLength,
  }
}

const uploadMap = (margin: number): Promise<MapAsset> =>
  payload.create({
    collection: "map-assets",
    data: { label: "Districts", source: { type: "custom", url: "https://example.com/districts" } },
    file: svgFile(margin),
  })

/** Article content holding one interactive map, as the editor stores it. */
const contentWithMap = (asset: MapAsset, widgetTitle: string, overrides: object[] = []) => ({
  root: {
    type: "root",
    children: [
      {
        type: "paragraph",
        children: [{ type: "text", text: "Before the map" }],
        direction: null,
        format: "",
      },
      {
        type: "block",
        version: 2,
        format: "",
        fields: {
          id: randomUUID(),
          blockName: "",
          blockType: "interactiveMap",
          widgetTitle,
          layout: "row",
          colorScale: "divergingRedBlue",
          colorBias: 1,
          maps: [
            {
              id: randomUUID(),
              title: "2024",
              svgAsset: asset.id,
              dataAttribute: "data-margin",
              overrides,
            },
          ],
        },
      },
    ],
    direction: null,
    format: "",
  },
})

const saveArticle = (title: string, data: Partial<Article>): Promise<Article> =>
  payload.create({
    collection: "articles",
    user: editor,
    context: { disableRevalidate: true },
    data: {
      title,
      slug: `map-images-${randomUUID().slice(0, 8)}`,
      generateSlug: false,
      syndicateToSubstack: true,
      ...data,
    } as unknown as Article,
  })

const update = (id: Article["id"], data: Partial<Article>): Promise<Article> =>
  payload.update({
    collection: "articles",
    id,
    user: editor,
    context: { disableRevalidate: true },
    data: data as never,
  })

/** The stored map pictures whose alt text names this widget, oldest first. */
const picturesOf = async (widgetTitle: string): Promise<Media[]> => {
  const { docs } = await payload.find({
    collection: "media",
    where: {
      and: [
        { filename: { contains: "interactive-map-" } },
        { alt: { equals: `Map: ${widgetTitle}` } },
      ],
    },
    sort: "createdAt",
    depth: 0,
    limit: 0,
    pagination: false,
  })
  return docs
}

const feedHTML = async (slug: string): Promise<string> => {
  const article = await querySyndicatedArticleBySlug(slug)
  expect(article).not.toBeNull()
  return substackArticleHTML(article!)
}

/** A widget title no other test's pictures share. */
const uniqueTitle = (label: string) => `${label} ${randomUUID().slice(0, 8)}`

beforeAll(async () => {
  payload = await getPayload()
  editor = await createUser("editor")
})

describe("map pictures for the Substack feed", () => {
  it("draws a published article's map once, and the feed shows the picture", async () => {
    const title = uniqueTitle("Published")
    const asset = await uploadMap(40)
    const article = await saveArticle("Map article", {
      _status: "published",
      content: contentWithMap(asset, title) as never,
    })

    const [picture, ...others] = await picturesOf(title)
    expect(others).toEqual([])
    // Media stores every image as WebP, at the size the drawing asks for.
    expect(picture).toMatchObject({
      filename: expect.stringMatching(/^interactive-map-[0-9a-f]{16}\.webp$/),
      mimeType: "image/webp",
      width: 1360,
      createdBy: editor.id,
    })

    const html = await feedHTML(article.slug!)
    expect(html).toContain(`<figure><img src="`)
    expect(html).toContain(`/${picture!.filename}" alt="Map: ${title}" width="1360"`)
    expect(html).toContain(
      `/articles/${article.slug}">View the interactive version on The Pragmatic Papers</a>`,
    )
    expect(html).not.toContain("View the interactive map")

    // Saving again with the map as it was draws nothing.
    await update(article.id, { title: "Map article, retitled", _status: "published" })
    expect(await picturesOf(title)).toHaveLength(1)
  })

  it("draws a changed map again and keeps the old picture for posts already imported", async () => {
    const title = uniqueTitle("Changed")
    const asset = await uploadMap(40)
    const article = await saveArticle("Changing map", {
      _status: "published",
      content: contentWithMap(asset, title) as never,
    })
    const [first] = await picturesOf(title)

    await update(article.id, {
      _status: "published",
      content: contentWithMap(asset, title, [{ regionId: "A", value: -30 }]) as never,
    })

    const pictures = await picturesOf(title)
    expect(pictures.map(({ id }) => id)).toEqual([first!.id, expect.any(Number)])
    expect(pictures[1]!.filename).not.toBe(first!.filename)
    expect(await feedHTML(article.slug!)).toContain(`/${pictures[1]!.filename}"`)
  })

  it("draws nothing for a draft, whose feed entry would link back instead", async () => {
    const title = uniqueTitle("Draft")
    const asset = await uploadMap(40)
    const article = await saveArticle("Draft map", {
      _status: "draft",
      content: contentWithMap(asset, title) as never,
    })
    expect(await picturesOf(title)).toEqual([])

    // Publishing it draws the picture.
    await update(article.id, { _status: "published" })
    expect(await picturesOf(title)).toHaveLength(1)
  })

  it("draws the picture again when the map's SVG is replaced", async () => {
    const title = uniqueTitle("Replaced")
    const asset = await uploadMap(40)
    const article = await saveArticle("Replaced map", {
      _status: "published",
      content: contentWithMap(asset, title) as never,
    })
    const [first] = await picturesOf(title)

    await payload.update({
      collection: "map-assets",
      id: asset.id,
      data: {},
      file: svgFile(-40),
      user: editor,
      // Outside Next there's no cache to revalidate; the redraw doesn't depend on it.
      context: { disableRevalidate: true },
    })

    const pictures = await picturesOf(title)
    expect(pictures).toHaveLength(2)
    expect(await feedHTML(article.slug!)).toContain(`/${pictures[1]!.filename}"`)
    expect(pictures[1]!.id).not.toBe(first!.id)
  })

  it("links back to the article when the picture was deleted, until the next save", async () => {
    const title = uniqueTitle("Deleted")
    const asset = await uploadMap(40)
    const article = await saveArticle("Deleted picture", {
      _status: "published",
      content: contentWithMap(asset, title) as never,
    })
    const [picture] = await picturesOf(title)
    await payload.delete({ collection: "media", id: picture!.id })

    expect(await feedHTML(article.slug!)).toContain(
      `View the interactive map “${title}” on The Pragmatic Papers →`,
    )

    await update(article.id, { _status: "published" })
    expect(await feedHTML(article.slug!)).toContain("<figure><img")
  })
})
