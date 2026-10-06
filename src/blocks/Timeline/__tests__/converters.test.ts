// @vitest-environment node
import { describe, expect, it } from "vitest"

import { timelineBlock } from "@/stories/fixtures/blocks"
import { feedContext } from "@/stories/fixtures/feedContext"

import { formatTimelineDate, timelineEventDisplay, timelineToHTML } from "../converters"

describe("timelineToHTML", () => {
  it("renders the title and a list of dated events with their sources", () => {
    expect(timelineToHTML(timelineBlock, feedContext())).toMatchInlineSnapshot(
      `"<h3>How the district map changed</h3><ul><li><strong>November 4, 2021</strong> — <strong>Commission draws the first map</strong><br />The bipartisan commission deadlocks and sends two maps to the legislature.</li><li><strong>February 17, 2022</strong> — <strong>Legislature adopts its own</strong><br />Lawmakers pass a map splitting the county into four districts. <a href="https://example.com/bill">[source]</a></li><li><strong>June 30, 2022</strong> — <strong>State court strikes it down</strong><br />The court rules the split violates the state constitution&#39;s compactness rule.</li><li><strong>January 9, 2023</strong> — <strong>A court-drawn map takes effect</strong><br />The special master&#39;s map is used for the 2024 elections.</li></ul>"`,
    )
  })

  it("makes a citation that references a site page absolute", () => {
    expect(
      timelineToHTML(
        {
          title: null,
          events: [
            {
              date: "2024-04-01T12:00:00.000Z",
              description: "Passed committee",
              enableCitation: true,
              citation: {
                type: "reference",
                reference: { relationTo: "articles", value: { slug: "other" } as never },
              },
            },
          ],
        },
        feedContext(),
      ),
    ).toMatchInlineSnapshot(
      `"<ul><li><strong>April 1, 2024</strong><br />Passed committee <a href="https://example.org/articles/other">[source]</a></li></ul>"`,
    )
  })

  it("escapes every value", () => {
    const html = timelineToHTML(
      {
        title: "R&D <timeline>",
        events: [{ date: "<soon>", title: "A & B", description: "x < y" }],
      },
      feedContext(),
    )
    expect(html).toMatchInlineSnapshot(
      `"<h3>R&amp;D &lt;timeline&gt;</h3><ul><li><strong>&lt;soon&gt;</strong> — <strong>A &amp; B</strong><br />x &lt; y</li></ul>"`,
    )
    expect(html).not.toContain("<timeline>")
  })

  it("renders nothing without events", () => {
    expect(timelineToHTML({ events: [] }, feedContext())).toBe("")
  })
})

describe("formatTimelineDate", () => {
  it("formats a stored date in UTC, whatever the time zone", () => {
    expect(formatTimelineDate("2021-11-04T12:00:00.000Z")).toBe("November 4, 2021")
    expect(formatTimelineDate("2024-03-12")).toBe("March 12, 2024")
  })

  it("shows anything that isn't an ISO date as is", () => {
    expect(formatTimelineDate("Spring 2024")).toBe("Spring 2024")
    expect(formatTimelineDate("<2024>")).toBe("<2024>")
  })
})

describe("timelineEventDisplay", () => {
  it("drops the citation when it's switched off", () => {
    expect(
      timelineEventDisplay({
        date: "2024-03-12",
        enableCitation: false,
        citation: { type: "custom", url: "https://x.test" },
      }).citationUrl,
    ).toBeNull()
  })
})
