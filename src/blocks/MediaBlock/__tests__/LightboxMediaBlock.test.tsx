import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Media } from "@/payload-types"
import {
  createLinkNode,
  createParagraph,
  createRichText,
  createTextNode,
} from "@/utilities/lexical"

// `@/components/Media` renders next/image, which needs the Next runtime. Swap it
// for a plain <img> that exposes the variant, so the dialog's copy is identifiable.
vi.mock("@/components/Media", () => ({
  isMedia: (media: unknown): boolean => Boolean(media) && typeof media !== "number",
  Media: ({ media, variant }: { media: Media; variant?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test stub, not real markup
    <img alt={media.alt ?? ""} data-variant={variant} />
  ),
}))

import { LightboxMediaBlock } from "../LightboxMediaBlock"

afterEach(cleanup)

const image: Media = {
  id: 1,
  alt: "Mountains at sunset",
  url: "/landscape.svg",
  filename: "landscape.svg",
  mimeType: "image/svg+xml",
  width: 1600,
  height: 900,
  createdAt: "2026-01-15T12:00:00.000Z",
  updatedAt: "2026-01-15T12:00:00.000Z",
}

const captioned: Media = {
  ...image,
  caption: createRichText([
    createParagraph([
      createTextNode("Photo: "),
      createLinkNode("County Archive", "https://example.com/archive"),
    ]),
  ]),
}

describe("LightboxMediaBlock", () => {
  it("renders nothing for an unresolved media relationship", () => {
    const { container } = render(<LightboxMediaBlock media={7} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("puts only the image inside the trigger, leaving caption links outside", () => {
    render(<LightboxMediaBlock media={captioned} />)
    const trigger = screen.getByRole("button")
    expect(within(trigger).getByRole("img", { name: image.alt! })).toBeInTheDocument()
    expect(within(trigger).queryByRole("link")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "County Archive" })).toBeInTheDocument()
  })

  it("wraps an uncaptioned trigger in a <figure>, never a <picture>", () => {
    const { container } = render(<LightboxMediaBlock media={image} />)
    const trigger = screen.getByRole("button")
    expect(trigger.closest("figure")).toBeInTheDocument()
    expect(container.querySelector("picture")).not.toBeInTheDocument()
  })

  it("keeps containerClassName on a flow-root wrapper and className on the frame", () => {
    const { container } = render(
      <LightboxMediaBlock media={captioned} containerClassName="-my-8" className="frame" />,
    )
    const wrapper = container.firstElementChild
    expect(wrapper?.tagName).toBe("DIV")
    expect(wrapper).toHaveClass("flow-root", "w-full", "-my-8")

    const frame = screen.getByRole("figure")
    expect(frame).toHaveClass("frame")
    // Gutters are off by default inside the lightbox, and the caption drops its container.
    expect(frame).not.toHaveClass("container")
    expect(frame.querySelector("figcaption")).not.toHaveClass("container")
  })

  it("lets callers turn the gutter and inner container back on", () => {
    render(<LightboxMediaBlock media={captioned} enableGutter disableInnerContainer={false} />)
    const frame = screen.getByRole("figure")
    expect(frame).toHaveClass("container")
    expect(frame.querySelector("figcaption")).toHaveClass("container")
  })

  it("opens a dialog with the full-size image when the image is clicked", async () => {
    render(<LightboxMediaBlock media={image} />)
    fireEvent.click(screen.getByRole("button"))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("img", { name: image.alt! })).toHaveAttribute(
      "data-variant",
      "xlarge",
    )
  })
})
