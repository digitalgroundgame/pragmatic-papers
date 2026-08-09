import type { Article, Media, MenuField, User, Volume } from "@/payload-types"
import { getServerSideURL } from "@/utilities/getURL"
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildHomeJsonLd,
  buildOrganizationJsonLd,
  buildPeriodicalJsonLd,
  buildPersonJsonLd,
  buildVolumeJsonLd,
  buildWebSiteJsonLd,
} from "@/utilities/structuredData"
import { beforeEach, describe, expect, it, vi } from "vitest"

const convertLexicalToPlaintext = vi.hoisted(() => vi.fn())
vi.mock("@payloadcms/richtext-lexical/plaintext", () => ({ convertLexicalToPlaintext }))

const SERVER_URL = getServerSideURL()

const makeArticle = (overrides: Partial<Article>): Article => overrides as Article
const makeUser = (overrides: Partial<User>): User => overrides as User
const makeVolume = (overrides: Partial<Volume>): Volume => overrides as Volume
const image = (url: string): Media => ({ url }) as Media

const customSocial = (url: string): NonNullable<MenuField>[number] =>
  ({
    link: { type: "custom", url },
  }) as NonNullable<MenuField>[number]

beforeEach(() => {
  convertLexicalToPlaintext.mockReset()
})

describe("buildArticleJsonLd", () => {
  it("populates every optional field when the source data is present", () => {
    const result = buildArticleJsonLd(
      makeArticle({
        title: "Fallback title",
        meta: {
          title: "Meta title",
          description: "A description",
          image: image("https://cdn/og.png"),
        },
        publishedAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2023-12-01T00:00:00.000Z",
        updatedAt: "2024-02-01T00:00:00.000Z",
        authors: [{ id: 1, name: "Alice", slug: "alice" } as User],
        topics: [
          { id: 1, name: "Economics" },
          { id: 2, name: "Politics" },
        ] as Article["topics"],
        populatedVolume: {
          id: 7,
          slug: "vol-7",
          title: "Volume Seven",
          volumeNumber: 7,
        } as Article["populatedVolume"],
      }),
      "/articles/my-post",
    )

    expect(result["@type"]).toBe("Article")
    expect(result["@id"]).toBe(`${SERVER_URL}/articles/my-post#article`)
    expect(result.headline).toBe("Meta title")
    expect(result.description).toBe("A description")
    expect(result.datePublished).toBe("2024-01-01T00:00:00.000Z")
    expect(result.dateModified).toBe("2024-02-01T00:00:00.000Z")
    expect(result.keywords).toBe("Economics, Politics")
    expect(result.image).toBe("https://cdn/og.png")
    expect(result.author).toEqual([
      {
        "@type": "Person",
        "@id": `${SERVER_URL}/authors/alice`,
        name: "Alice",
        url: `${SERVER_URL}/authors/alice`,
      },
    ])
    expect(result.isPartOf).toEqual({
      "@type": "PublicationVolume",
      "@id": `${SERVER_URL}/volumes/vol-7#volume`,
      name: "Volume Seven",
      volumeNumber: 7,
      isPartOf: { "@type": "Periodical", "@id": `${SERVER_URL}/#periodical` },
    })
    expect(result.mainEntityOfPage).toEqual({
      "@type": "WebPage",
      "@id": `${SERVER_URL}/articles/my-post`,
    })
  })

  it("omits optional fields and falls back to title / createdAt when data is missing", () => {
    const result = buildArticleJsonLd(
      makeArticle({
        title: "Only title",
        createdAt: "2023-12-01T00:00:00.000Z",
        updatedAt: "2024-02-01T00:00:00.000Z",
      }),
      "/articles/bare",
    )

    expect(result.headline).toBe("Only title")
    expect(result.description).toBeUndefined()
    expect(result.datePublished).toBe("2023-12-01T00:00:00.000Z")
    expect(result.keywords).toBeUndefined()
    expect(result.author).toBeUndefined()
    expect(result.image).toBeUndefined()
    expect(result.isPartOf).toBeUndefined()
  })

  it("drops numeric (unpopulated) topics from keywords", () => {
    const result = buildArticleJsonLd(
      makeArticle({
        title: "T",
        createdAt: "2023-12-01T00:00:00.000Z",
        updatedAt: "2024-02-01T00:00:00.000Z",
        topics: [5, { id: 1, name: "Economics" }] as Article["topics"],
      }),
      "/articles/t",
    )

    expect(result.keywords).toBe("Economics")
  })

  it("falls back to a generated volume name and omits the volume @id when the slug is missing", () => {
    const result = buildArticleJsonLd(
      makeArticle({
        title: "T",
        createdAt: "2023-12-01T00:00:00.000Z",
        updatedAt: "2024-02-01T00:00:00.000Z",
        populatedVolume: { id: 7, volumeNumber: 7 } as Article["populatedVolume"],
      }),
      "/articles/t",
    )

    expect(result.isPartOf).toMatchObject({
      "@id": undefined,
      name: "Volume 7",
      volumeNumber: 7,
    })
  })
})

describe("buildOrganizationJsonLd", () => {
  it("includes sameAs when links are provided", () => {
    const result = buildOrganizationJsonLd(["https://x.com/pp"])
    expect(result.sameAs).toEqual(["https://x.com/pp"])
    expect(result["@id"]).toBe(`${SERVER_URL}/#organization`)
  })

  it("omits sameAs when no links are provided", () => {
    expect(buildOrganizationJsonLd().sameAs).toBeUndefined()
    expect(buildOrganizationJsonLd([]).sameAs).toBeUndefined()
  })
})

describe("buildWebSiteJsonLd", () => {
  it("emits stable website identity", () => {
    expect(buildWebSiteJsonLd()).toEqual({
      "@type": "WebSite",
      "@id": `${SERVER_URL}/#website`,
      name: "The Pragmatic Papers",
      url: SERVER_URL,
    })
  })
})

describe("buildPeriodicalJsonLd", () => {
  it("references the organization as publisher", () => {
    const result = buildPeriodicalJsonLd()
    expect(result["@id"]).toBe(`${SERVER_URL}/#periodical`)
    expect(result.publisher).toEqual({
      "@type": "Organization",
      "@id": `${SERVER_URL}/#organization`,
    })
  })
})

describe("buildPersonJsonLd", () => {
  it("populates every optional field when the source data is present", () => {
    convertLexicalToPlaintext.mockReturnValue("Bio text")
    const result = buildPersonJsonLd(
      makeUser({
        name: "Alice",
        biography: { root: {} } as User["biography"],
        profileImage: image("https://cdn/alice.png"),
        affiliation: "Acme",
        socials: [
          customSocial("https://x.com/alice"),
          { link: { type: "reference" } },
        ] as MenuField,
      }),
      "/authors/alice",
    )

    expect(result["@type"]).toBe("Person")
    expect(result["@id"]).toBe(`${SERVER_URL}/authors/alice`)
    expect(result.name).toBe("Alice")
    expect(result.description).toBe("Bio text")
    expect(result.image).toBe("https://cdn/alice.png")
    // Only the "custom" social survives the filter.
    expect(result.sameAs).toEqual(["https://x.com/alice"])
    expect(result.affiliation).toEqual({ "@type": "Organization", name: "Acme" })
  })

  it("omits optional fields when data is missing", () => {
    const result = buildPersonJsonLd(makeUser({ name: null }), "/authors/anon")

    expect(result.name).toBeUndefined()
    expect(result.description).toBeUndefined()
    expect(result.image).toBeUndefined()
    expect(result.sameAs).toBeUndefined()
    expect(result.affiliation).toBeUndefined()
    expect(convertLexicalToPlaintext).not.toHaveBeenCalled()
  })

  it("omits description when the converter yields an empty string", () => {
    convertLexicalToPlaintext.mockReturnValue("")
    const result = buildPersonJsonLd(
      makeUser({ name: "Alice", biography: { root: {} } as User["biography"] }),
      "/authors/alice",
    )

    expect(result.description).toBeUndefined()
  })
})

describe("buildBreadcrumbJsonLd", () => {
  it("returns a single Home crumb when no items are given", () => {
    const result = buildBreadcrumbJsonLd()
    expect(result.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: SERVER_URL },
    ])
  })

  it("prepends Home and numbers each provided crumb", () => {
    const result = buildBreadcrumbJsonLd([
      { name: "Articles", path: "/articles" },
      { name: "My Post", path: "/articles/my-post" },
    ])
    expect(result.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: SERVER_URL },
      { "@type": "ListItem", position: 2, name: "Articles", item: `${SERVER_URL}/articles` },
      { "@type": "ListItem", position: 3, name: "My Post", item: `${SERVER_URL}/articles/my-post` },
    ])
  })
})

describe("buildCollectionPageJsonLd", () => {
  it("builds a collection page with an absolute url", () => {
    expect(buildCollectionPageJsonLd("Authors", "All authors", "/authors")).toEqual({
      "@type": "CollectionPage",
      name: "Authors",
      description: "All authors",
      url: `${SERVER_URL}/authors`,
    })
  })
})

describe("buildHomeJsonLd", () => {
  it("returns website, organization, periodical, and breadcrumb nodes in order", () => {
    const nodes = buildHomeJsonLd()
    expect(nodes.map((n) => (n as { "@type": string })["@type"])).toEqual([
      "WebSite",
      "Organization",
      "Periodical",
      "BreadcrumbList",
    ])
  })

  it("threads social links into the organization's sameAs", () => {
    const nodes = buildHomeJsonLd([customSocial("https://x.com/pp")] as MenuField)
    const org = nodes[1] as { sameAs?: string[] }
    expect(org.sameAs).toEqual(["https://x.com/pp"])
  })

  it("leaves sameAs unset when there are no social links", () => {
    const org = buildHomeJsonLd()[1] as { sameAs?: string[] }
    expect(org.sameAs).toBeUndefined()
  })
})

describe("buildVolumeJsonLd", () => {
  it("populates every optional field when the source data is present", () => {
    const result = buildVolumeJsonLd(
      makeVolume({
        title: "Volume Seven",
        description: "Seventh volume",
        volumeNumber: 7,
        publishedAt: "2024-01-01T00:00:00.000Z",
      }),
      "/volumes/vol-7",
    )

    expect(result).toEqual({
      "@type": "PublicationVolume",
      "@id": `${SERVER_URL}/volumes/vol-7#volume`,
      name: "Volume Seven",
      description: "Seventh volume",
      volumeNumber: 7,
      datePublished: "2024-01-01T00:00:00.000Z",
      url: `${SERVER_URL}/volumes/vol-7`,
      isPartOf: { "@type": "Periodical", "@id": `${SERVER_URL}/#periodical` },
    })
  })

  it("omits description and datePublished when missing", () => {
    const result = buildVolumeJsonLd(
      makeVolume({ title: "Bare", volumeNumber: 1 }),
      "/volumes/bare",
    )

    expect(result.description).toBeUndefined()
    expect(result.datePublished).toBeUndefined()
  })
})
