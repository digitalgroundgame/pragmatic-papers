import { describe, expect, it } from "vitest"

import { groupDocsBySection } from "../sections"

describe("groupDocsBySection", () => {
  it("groups docs in the sidebar's order, by title, leaving out empty sections", () => {
    const groups = groupDocsBySection([
      { title: "Topics", section: "writing" },
      { title: "Volumes", section: "site" },
      { title: "Footnotes", section: "writing" },
      { title: "The bell", section: null },
    ])
    expect(groups.map((group) => [group.label, group.docs.map((doc) => doc.title)])).toEqual([
      ["Getting started", ["The bell"]],
      ["Writing articles", ["Footnotes", "Topics"]],
      ["Pages and the site", ["Volumes"]],
    ])
  })
})
