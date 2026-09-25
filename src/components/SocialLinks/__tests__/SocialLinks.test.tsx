import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import type { MenuField } from "@/payload-types"
import { SocialLinks } from "../index"

afterEach(cleanup)

type MenuEntry = NonNullable<MenuField>[number]

function customEntry(
  url: string | null,
  { id = "entry-id", label = null }: { id?: string; label?: string | null } = {},
): MenuEntry {
  return { id, link: { type: "custom", url, label } }
}

describe("SocialLinks", () => {
  it("renders nothing when socials is undefined", () => {
    const { container } = render(<SocialLinks />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when socials is empty", () => {
    const { container } = render(<SocialLinks socials={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when no entries resolve to a valid link", () => {
    const { container } = render(<SocialLinks socials={[customEntry(null)]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("uses a default aria-label", () => {
    render(<SocialLinks socials={[customEntry("https://x.com/example")]} />)
    expect(screen.getByRole("navigation", { name: "Social Links" })).toBeInTheDocument()
  })

  it("respects a custom aria-label", () => {
    render(<SocialLinks aria-label="Follow us" socials={[customEntry("https://x.com/example")]} />)
    expect(screen.getByRole("navigation", { name: "Follow us" })).toBeInTheDocument()
  })

  it("renders one accessible link per valid entry with safe target/rel", () => {
    render(
      <SocialLinks
        socials={[
          customEntry("https://youtu.be/abc", { id: "yt", label: "YouTube" }),
          customEntry("twitch.tv/example", { id: "tw" }),
          customEntry("https://discord.gg/abc", { id: "dc" }),
        ]}
      />,
    )
    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(3)
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank")
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"))
    }
    expect(links[0]).toHaveAttribute("href", "https://youtu.be/abc")
    expect(links[1]).toHaveAttribute("href", "https://twitch.tv/example")
    expect(screen.getByText("YouTube")).toBeInTheDocument()
  })

  it("renders the expected icons for a mix of platforms", () => {
    const { container } = render(
      <SocialLinks
        socials={[
          customEntry("https://youtu.be/abc", { id: "yt" }),
          customEntry("https://twitch.tv/example", { id: "tw" }),
          customEntry("https://discord.gg/abc", { id: "dc" }),
          customEntry("https://example.com", { id: "generic" }),
        ]}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
