import type React from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/font/local", () => ({ default: () => ({ variable: "__variable_display" }) }))
vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "__variable_sans" }) }))
vi.mock("@wrksz/themes/next", () => ({ ThemeProvider: () => null }))
vi.mock("@/components/AdminBar", () => ({ AdminBar: () => null }))
vi.mock("@/utilities/getURL", () => ({ getServerSideURL: () => "https://example.test" }))

const { default: FeedRootLayout, metadata, viewport } = await import("../layout")
const { AdminBar } = await import("@/components/AdminBar")

type El = React.ReactElement<{ children?: React.ReactNode } & Record<string, unknown>>

describe("feed root layout", () => {
  const html = FeedRootLayout({ children: <main id="feed" /> }) as El
  const [, body] = html.props.children as El[]

  it("sets the language and both font variables on <html>", () => {
    expect(html.type).toBe("html")
    expect(html.props.lang).toBe("en")
    expect(html.props.className).toContain("__variable_display")
    expect(html.props.className).toContain("__variable_sans")
  })

  it("renders the page inside the theme provider, after the admin bar", () => {
    const provider = body?.props.children as El
    const [adminBar, page] = provider.props.children as El[]
    expect(provider.props.defaultTheme).toBe("system")
    expect(adminBar?.type).toBe(AdminBar)
    expect(page?.props.id).toBe("feed")
  })

  it("fills the screen on notched phones and names the page", () => {
    expect(viewport.viewportFit).toBe("cover")
    expect(metadata.title).toBe("Feed · Pragmatic Papers")
    expect(metadata.metadataBase?.toString()).toBe("https://example.test/")
  })
})
