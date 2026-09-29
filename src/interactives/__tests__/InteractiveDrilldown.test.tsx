import { cleanup, render } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { DrilldownAsset } from "@/interactives/engine/types"

const { client } = vi.hoisted(() => ({ client: vi.fn() }))

vi.mock("@/interactives/engine/styles.css", () => ({}))
// The client stage has its own tests; here it only records what the section hands it.
vi.mock("@/interactives/engine/DrilldownMapClient", () => ({
  DrilldownMapClient: ({ children, ...props }: { children: React.ReactNode }) => {
    client(props)
    return <div data-testid="client">{children}</div>
  },
}))
vi.mock("@/interactives/engine/DrilldownOverviewSvg", () => ({
  DrilldownOverviewSvg: ({ asset }: { asset: DrilldownAsset }) => (
    <svg data-testid="overview" data-first-path={asset.paths[0]?.d} />
  ),
}))
vi.mock("@/interactives/engine/regions", () => ({ buildRegionIndex: () => new Map() }))

import type { ComposedOverview } from "../load"
import { InteractiveDrilldown } from "../InteractiveDrilldown"

const overview = {
  paths: [
    { id: "ca8", d: "M0 0L10 10Z" },
    { id: "ca9", d: "M5 5L20 20Z" },
  ],
} as unknown as DrilldownAsset

const composed = {
  overview,
  searchUrl: "/interactives/courts/search",
  childAssets: [
    { regionId: "ca8", url: "/r/ca8", geometryUrl: "/g/ca8/abc" },
    { regionId: "ca9", url: "/r/ca9", geometryUrl: "/g/ca9/def" },
  ],
} as unknown as ComposedOverview

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(cleanup)

describe("InteractiveDrilldown", () => {
  it("prefetches both halves of every region, so the page archives whole", () => {
    render(<InteractiveDrilldown composed={composed} />)
    // React hoists resource hints into <head>, so look for them across the whole document.
    const hrefs = [...document.querySelectorAll("link[rel='prefetch'][as='fetch']")].map((l) =>
      l.getAttribute("href"),
    )
    expect(hrefs).toEqual(expect.arrayContaining(["/r/ca8", "/g/ca8/abc", "/r/ca9", "/g/ca9/def"]))
  })

  it("renders the overview SVG in full but sends the client its paths without geometry", () => {
    const { getByTestId } = render(<InteractiveDrilldown composed={composed} />)
    expect(getByTestId("overview")).toHaveAttribute("data-first-path", "M0 0L10 10Z")
    const { overview: sent } = client.mock.calls[0]![0] as { overview: DrilldownAsset }
    expect(sent.paths.map((p) => p.d)).toEqual(["", ""])
    expect(sent.paths.map((p) => p.id)).toEqual(["ca8", "ca9"])
    // The server-rendered asset is left intact for the SVG above.
    expect(overview.paths[0]!.d).toBe("M0 0L10 10Z")
  })

  it("passes the search URL, and a label only when there is one", () => {
    render(<InteractiveDrilldown composed={composed} searchLabel="Search judges" />)
    expect(client.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        search: { url: "/interactives/courts/search", label: "Search judges" },
        childAssets: composed.childAssets,
      }),
    )
    cleanup()
    client.mockClear()
    render(<InteractiveDrilldown composed={composed} />)
    expect((client.mock.calls[0]![0] as { search: object }).search).toEqual({
      url: "/interactives/courts/search",
    })
  })

  it("labels the section for assistive tech", () => {
    const { container } = render(<InteractiveDrilldown composed={composed} />)
    expect(container.querySelector("section[data-interactive-drilldown]")).toHaveAttribute(
      "aria-label",
      "Interactive map",
    )
  })
})
