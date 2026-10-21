import { isValidElement, type ReactElement, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { default: RichText, jsxConverters } = await import("..")
const { BannerBlock } = await import("@/blocks/Banner/Component")
const { CodeBlock } = await import("@/blocks/Code/Component")
const { CallToActionBlock } = await import("@/blocks/CallToAction/Component")
const { FootnoteBlock } = await import("@/blocks/Footnote/Component")
const { InteractiveMapBlock } = await import("@/blocks/InteractiveMap/InteractiveMapBlock")
const { MathBlock } = await import("@/blocks/Math/Component")
const { LightboxMediaBlock } = await import("@/blocks/MediaBlock/LightboxMediaBlock")
const { MediaCollageBlock } = await import("@/blocks/MediaCollageBlock/component.lazy")
const { MerchBlock } = await import("@/blocks/Merch/Component")
const { NewsletterSignupBlock } = await import("@/blocks/NewsletterSignup/Component")
const { SquiggleRuleBlock } = await import("@/blocks/SquiggleRule/Component")
const { TimelineBlock } = await import("@/blocks/Timeline/Component")
const Embeds = await import("@/blocks/SocialEmbed")
const { HoverPrefetchLink } = await import("@/components/Link/HoverPrefetchLink")

type Converter = (args: { node: unknown; nodesToJSX: (args: unknown) => ReactNode[] }) => ReactNode

const converters = (
  jsxConverters as unknown as (args: { defaultConverters: object }) => {
    blocks: Record<string, Converter>
    inlineBlocks: Record<string, Converter>
    link: Converter
  }
)({ defaultConverters: {} })

/** The first element of `type` in a converter's output, looking through wrappers. */
function find(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | null {
  if (!isValidElement<Record<string, unknown>>(node)) return null
  if (node.type === type) return node
  const children = node.props.children
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = find(child as ReactNode, type)
    if (found) return found
  }
  return null
}

const render = (converter: Converter, fields: Record<string, unknown>) =>
  converter({ node: { type: "block", fields }, nodesToJSX: () => [] })

describe("RichText's block converters", () => {
  it.each([
    ["banner", BannerBlock],
    ["code", CodeBlock],
    ["cta", CallToActionBlock],
    ["displayMathBlock", MathBlock],
    ["interactiveMap", InteractiveMapBlock],
    ["mediaBlock", LightboxMediaBlock],
    ["mediaCollage", MediaCollageBlock],
    ["merch", MerchBlock],
    ["newsletterSignup", NewsletterSignupBlock],
    ["socialEmbed", Embeds.SocialEmbedBlock],
    ["squiggleRule", SquiggleRuleBlock],
    ["timeline", TimelineBlock],
    // Legacy embed blocks still found in old articles.
    ["twitterEmbed", Embeds.TwitterEmbedBlock],
    ["youtubeEmbed", Embeds.YouTubeEmbedBlock],
    ["redditEmbed", Embeds.RedditEmbedBlock],
    ["blueSkyEmbed", Embeds.BlueskyEmbedBlock],
    ["tiktokEmbed", Embeds.TikTokEmbedBlock],
  ])("renders %s with its block component and fields", (slug, Component) => {
    const converter = converters.blocks[slug]
    expect(converter).toBeTypeOf("function")
    const element = find(render(converter!, { id: `id-${slug}`, blockType: slug }), Component)
    expect(element).not.toBeNull()
    expect(element!.props).toMatchObject({ id: `id-${slug}`, blockType: slug })
  })

  it("passes the social embed only its own fields", () => {
    const fields = { id: "e1", blockType: "socialEmbed", platform: "twitter", url: "https://x.com" }
    const element = find(render(converters.blocks.socialEmbed!, fields), Embeds.SocialEmbedBlock)
    expect(element!.props).toEqual(fields)
  })

  it("renders merch without a gutter inside the article column", () => {
    const element = find(render(converters.blocks.merch!, { blockType: "merch" }), MerchBlock)
    expect(element!.props.enableGutter).toBe(false)
  })

  it.each([
    ["inlineMathBlock", MathBlock],
    ["footnote", FootnoteBlock],
  ])("renders the inline %s block", (slug, Component) => {
    const element = find(render(converters.inlineBlocks[slug]!, { blockType: slug }), Component)
    expect(element).not.toBeNull()
  })
})

describe("RichText's link converter", () => {
  const link = (fields: Record<string, unknown>) =>
    find(
      converters.link({
        node: { type: "link", fields, children: [] },
        nodesToJSX: () => ["Label"],
      }),
      HoverPrefetchLink,
    )!

  it("links to the internal document's path", () => {
    const element = link({
      linkType: "internal",
      doc: { relationTo: "articles", value: { slug: "my-article" } },
    })
    expect(element.props.href).toBe("/articles/my-article")
    expect(element.props.target).toBeUndefined()
  })

  it("opens a custom link in a new tab when asked, without the opener", () => {
    const element = link({ linkType: "custom", url: "https://example.com", newTab: true })
    expect(element.props).toMatchObject({
      href: "https://example.com",
      target: "_blank",
      rel: "noopener noreferrer",
    })
  })

  it("neutralises a javascript: URL", () => {
    const element = link({ linkType: "custom", url: "javascript:alert(1)" })
    expect(element.props.href).not.toMatch(/^javascript:/)
  })
})

describe("RichText", () => {
  const data = { root: { type: "root", children: [] } } as never

  it("renders nothing without data", () => {
    expect(RichText({ data: null })).toBeNull()
  })

  it("is a prose container by default", () => {
    const element = RichText({ data }) as ReactElement<{ className: string }>
    expect(element.props.className.split(" ")).toEqual(
      expect.arrayContaining(["payload-richtext", "container", "prose"]),
    )
  })

  it("drops the gutter and prose when asked", () => {
    const element = RichText({
      data,
      enableGutter: false,
      enableProse: false,
      className: "extra",
    }) as ReactElement<{ className: string }>
    const classes = element.props.className.split(" ")
    expect(classes).toEqual(expect.arrayContaining(["max-w-none", "extra"]))
    expect(classes).not.toContain("container")
    expect(classes).not.toContain("prose")
  })
})
