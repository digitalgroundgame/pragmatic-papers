import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import type { MenuField } from "@/payload-types"
import { AuthorLinks, deriveAuthorSocialLinks, normalizeExternalUrl } from "../AuthorLinks"

afterEach(cleanup)

type MenuEntry = NonNullable<MenuField>[number]

function customEntry(
  url: string | null,
  { id = "entry-id", label = null }: { id?: string; label?: string | null } = {},
): MenuEntry {
  return { id, link: { type: "custom", url, label } }
}

describe("normalizeExternalUrl", () => {
  it.each([
    ["", ""],
    ["   ", ""],
    ["https://x.com/example", "https://x.com/example"],
    ["mailto:someone@example.com", "mailto:someone@example.com"],
    ["x.com/example", "https://x.com/example"],
    ["//x.com/example", "https://x.com/example"],
    ["  github.com/example  ", "https://github.com/example"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeExternalUrl(input)).toBe(expected)
  })
})

describe("deriveAuthorSocialLinks", () => {
  it("returns an empty array for null entries", () => {
    expect(deriveAuthorSocialLinks(null)).toEqual([])
  })

  it("returns an empty array when there are no entries", () => {
    expect(deriveAuthorSocialLinks([])).toEqual([])
  })

  it("skips entries without a link", () => {
    expect(deriveAuthorSocialLinks([{ id: "a", link: undefined } as MenuEntry])).toEqual([])
  })

  it("skips reference-type links", () => {
    const entry: MenuEntry = {
      id: "ref",
      link: { type: "reference", url: null, label: null },
    }
    expect(deriveAuthorSocialLinks([entry])).toEqual([])
  })

  it("skips custom links without a url", () => {
    expect(deriveAuthorSocialLinks([customEntry(null)])).toEqual([])
    expect(deriveAuthorSocialLinks([customEntry("")])).toEqual([])
  })

  it("skips custom links whose url is only whitespace", () => {
    expect(deriveAuthorSocialLinks([customEntry("   ")])).toEqual([])
  })

  it("maps a custom link, normalizing the url and preserving the label", () => {
    const links = deriveAuthorSocialLinks([
      customEntry("x.com/example", { id: "twitter-1", label: "My X" }),
    ])
    expect(links).toEqual([
      { id: "twitter-1", href: "https://x.com/example", icon: "twitter", label: "My X" },
    ])
  })

  it("falls back to the href for the id when the entry id is missing", () => {
    const links = deriveAuthorSocialLinks([customEntry("https://x.com/example", { id: "" })])
    expect(links[0]?.id).toBe("https://x.com/example")
  })

  it.each([
    ["https://twitter.com/example", "twitter"],
    ["https://x.com/example", "twitter"],
    ["https://youtu.be/dQw4w9WgXcQ", "youtube"],
    ["https://twitch.tv/example", "twitch"],
    ["https://instagram.com/example", "instagram"],
    ["https://discord.gg/abc123", "discord"],
    ["https://github.com/example", "github"],
    ["https://www.linkedin.com/in/example", "linkedin"],
  ])("detects the platform icon for %s", (url, expectedIcon) => {
    expect(deriveAuthorSocialLinks([customEntry(url)])[0]?.icon).toBe(expectedIcon)
  })

  it("uses the generic icon for unrecognized hosts and non-http(s) urls", () => {
    expect(deriveAuthorSocialLinks([customEntry("https://example.com")])[0]?.icon).toBe("generic")
    expect(deriveAuthorSocialLinks([customEntry("mailto:a@b.com")])[0]?.icon).toBe("generic")
  })
})

describe("AuthorLinks", () => {
  it("renders nothing when socials is undefined", () => {
    const { container } = render(<AuthorLinks />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when no entries resolve to a valid link", () => {
    const { container } = render(<AuthorLinks socials={[customEntry(null)]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders one accessible link per valid social entry", () => {
    render(
      <AuthorLinks
        socials={[
          customEntry("https://youtu.be/abc", { id: "yt", label: "My channel" }),
          customEntry("twitch.tv/example", { id: "tw" }),
        ]}
      />,
    )
    const nav = screen.getByRole("navigation", { name: "Author Links" })
    expect(nav).toBeInTheDocument()

    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(2)

    const youtube = links[0]
    expect(youtube).toHaveAttribute("href", "https://youtu.be/abc")
    expect(youtube).toHaveAttribute("target", "_blank")
    expect(youtube).toHaveAttribute("rel", expect.stringContaining("noopener"))
    expect(screen.getByText("My channel")).toBeInTheDocument()
  })

  it("renders the expected icons for a mix of platforms", () => {
    const { container } = render(
      <AuthorLinks
        socials={[
          customEntry("https://youtu.be/abc", { id: "yt" }),
          customEntry("https://discord.gg/abc", { id: "dc" }),
          customEntry("https://example.com", { id: "generic" }),
        ]}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
