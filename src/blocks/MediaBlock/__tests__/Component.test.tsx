import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Media } from "@/payload-types"
import {
  createLinkNode,
  createParagraph,
  createRichText,
  createTextNode,
} from "@/utilities/lexical"

// `@/components/Media` renders next/image, which needs the Next runtime. Swap it
// for a plain <img> that exposes the props MediaBlockImage passes down.
vi.mock("@/components/Media", () => ({
  isMedia: (media: unknown): boolean => Boolean(media) && typeof media !== "number",
  Media: ({
    media,
    className,
    sizes,
    variant,
  }: {
    media: Media
    className?: string
    sizes?: string
    variant?: string
  }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test stub, not real markup
    <img alt={media.alt ?? ""} className={className} data-sizes={sizes} data-variant={variant} />
  ),
}))

import { MediaBlock, MediaBlockCaption, MediaBlockFrame, MediaBlockImage } from "../Component"

afterEach(cleanup)

const image: Media = {
  id: 1,
  alt: "Mountains at sunset",
  url: "/landscape.svg",
  mimeType: "image/svg+xml",
  width: 1600,
  height: 900,
  createdAt: "2026-01-15T12:00:00.000Z",
  updatedAt: "2026-01-15T12:00:00.000Z",
}

const caption = createRichText([
  createParagraph([
    createTextNode("The ridge above town. Photo: "),
    createLinkNode("County Archive", "https://example.com/archive"),
  ]),
])

const captioned: Media = { ...image, caption }

describe("MediaBlock", () => {
  it("renders nothing for an unresolved media relationship", () => {
    const { container } = render(<MediaBlock media={7} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("wraps an uncaptioned image in a <picture> with no caption", () => {
    const { container } = render(<MediaBlock media={image} />)
    const frame = container.firstElementChild
    expect(frame?.tagName).toBe("PICTURE")
    expect(screen.getByRole("img", { name: image.alt! })).toBeInTheDocument()
    expect(container.querySelector("figcaption")).not.toBeInTheDocument()
  })

  it("wraps a captioned image in a <figure> with its caption and links", () => {
    render(<MediaBlock media={captioned} captionClassName="caption-extra" />)
    const figure = screen.getByRole("figure")
    const figcaption = figure.querySelector("figcaption")
    expect(figcaption).toHaveTextContent("The ridge above town. Photo: County Archive")
    expect(figcaption).toHaveClass("container", "caption-extra")
    expect(screen.getByRole("link", { name: "County Archive" })).toHaveAttribute(
      "href",
      "https://example.com/archive",
    )
  })

  it("drops the caption's container when disableInnerContainer is set", () => {
    render(<MediaBlock media={captioned} disableInnerContainer />)
    expect(screen.getByRole("figure").querySelector("figcaption")).not.toHaveClass("container")
  })

  it("applies the gutter by default and breakout on request", () => {
    const { container, rerender } = render(<MediaBlock media={image} className="extra" />)
    expect(container.firstElementChild).toHaveClass("container", "extra")
    expect(container.firstElementChild).not.toHaveClass("lg:-mx-8")

    rerender(<MediaBlock media={image} enableGutter={false} breakout />)
    expect(container.firstElementChild).not.toHaveClass("container")
    expect(container.firstElementChild).toHaveClass("lg:-mx-8", "xl:-mx-16")
  })

  it("passes image styling through to the media", () => {
    render(<MediaBlock media={image} imgClassName="rounded" sizes="50vw" variant="large" />)
    const img = screen.getByRole("img")
    expect(img).toHaveClass("border", "rounded")
    expect(img).toHaveAttribute("data-sizes", "50vw")
    expect(img).toHaveAttribute("data-variant", "large")
  })
})

describe("MediaBlockFrame", () => {
  it("renders a <figure> unless told otherwise", () => {
    const { container, rerender } = render(<MediaBlockFrame>child</MediaBlockFrame>)
    expect(container.firstElementChild?.tagName).toBe("FIGURE")

    rerender(<MediaBlockFrame as="picture">child</MediaBlockFrame>)
    expect(container.firstElementChild?.tagName).toBe("PICTURE")
  })
})

describe("MediaBlockImage", () => {
  it("defaults to the medium variant and article-width sizes", () => {
    render(<MediaBlockImage media={image} />)
    const img = screen.getByRole("img")
    expect(img).toHaveAttribute("data-variant", "medium")
    expect(img).toHaveAttribute("data-sizes", "(max-width: 768px) 100vw, 800px")
  })

  it("falls back to the default sizes for an empty string", () => {
    render(<MediaBlockImage media={image} sizes="" />)
    expect(screen.getByRole("img")).toHaveAttribute("data-sizes", "(max-width: 768px) 100vw, 800px")
  })
})

describe("MediaBlockCaption", () => {
  it("renders the caption's rich text inside a figcaption", () => {
    const { container } = render(<MediaBlockCaption caption={caption} />)
    expect(container.firstElementChild?.tagName).toBe("FIGCAPTION")
    expect(screen.getByRole("link", { name: "County Archive" })).toBeInTheDocument()
  })

  it("renders new-tab, internal and auto links", () => {
    const internal = {
      ...createLinkNode("Earlier story", ""),
      fields: {
        linkType: "internal",
        newTab: false,
        doc: { relationTo: "articles", value: { id: 2, slug: "earlier-story" } },
      },
    }
    const autolink = {
      ...createLinkNode("example.org", "https://example.org"),
      type: "autolink",
      fields: { linkType: "custom", newTab: true, url: "https://example.org" },
    }
    const links = createRichText([
      createParagraph([
        createLinkNode("Archive", "https://example.com/archive", true),
        internal,
        autolink,
      ]),
    ])

    render(<MediaBlockCaption caption={links} />)

    const archive = screen.getByRole("link", { name: "Archive" })
    expect(archive).toHaveAttribute("target", "_blank")
    expect(archive).toHaveAttribute("rel", "noopener noreferrer")

    const earlier = screen.getByRole("link", { name: "Earlier story" })
    expect(earlier).toHaveAttribute("href", "/articles/earlier-story")
    expect(earlier).not.toHaveAttribute("target")

    const auto = screen.getByRole("link", { name: "example.org" })
    expect(auto).toHaveAttribute("href", "https://example.org")
    expect(auto).toHaveAttribute("target", "_blank")
  })
})
