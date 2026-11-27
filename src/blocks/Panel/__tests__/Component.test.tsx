import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// Each panel has its own query; here they render as markers naming what they were given.
vi.mock("@/components/Aside", () => {
  const marker = (name: string) => {
    const Marker = ({ title, topicId }: { title?: string | null; topicId?: number }) => (
      <p>{[name, title ?? "", topicId ?? ""].join("|")}</p>
    )
    Marker.displayName = name
    return Marker
  }
  return {
    MostReadPanel: marker("mostRead"),
    LatestVolumePanel: marker("latestVolume"),
    TopicsPanel: marker("topics"),
    RelatedTopicsPanel: marker("relatedTopics"),
    ContributorsPanel: marker("contributors"),
    SearchTipsPanel: marker("searchTips"),
    NewsletterPanel: marker("newsletter"),
  }
})

import { PANEL_SOURCES } from "../config"
import { hasPanels, RenderPanels } from "../Component"

afterEach(cleanup)

const panels = PANEL_SOURCES.map(({ value }, i) => ({
  id: String(i),
  blockType: "panel" as const,
  source: value,
  title: value === "topics" ? "Sections" : null,
}))

describe("an aside's panels", () => {
  it("renders every source, in the editors' order, with the heading they gave it", () => {
    const { container } = render(<RenderPanels panels={panels} context={{ topicId: 7 }} />)
    expect([...container.querySelectorAll("p")].map((p) => p.textContent)).toEqual([
      "mostRead||7",
      "latestVolume||",
      "topics|Sections|",
      "relatedTopics||7",
      "contributors||7",
      "searchTips||",
      "newsletter||",
    ])
  })

  it("leaves out panels about one topic on a page that isn't a topic's", () => {
    render(<RenderPanels panels={panels} />)
    expect(screen.queryByText(/^relatedTopics/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^contributors/)).not.toBeInTheDocument()
    expect(screen.getByText("mostRead||")).toBeInTheDocument()
  })

  it("knows an empty aside from one with panels", () => {
    expect(hasPanels([])).toBe(false)
    expect(hasPanels(null)).toBe(false)
    expect(hasPanels(panels)).toBe(true)
  })
})
