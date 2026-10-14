import { describe, expect, it } from "vitest"

import { adjacentDocs, groupDocsBySection, groupSectionsByArea } from "../sections"

describe("groupDocsBySection", () => {
  it("groups docs in the sidebar's order, by sidebar name, leaving out empty sections", () => {
    const groups = groupDocsBySection([
      { title: "Tag articles with topics", navTitle: "Topics", section: "writing" },
      { title: "Volumes", section: "pages" },
      { title: "Footnotes", section: "writing" },
      { title: "The bell", section: null },
    ])
    expect(groups.map((group) => [group.label, group.docs.map((doc) => doc.title)])).toEqual([
      ["Getting started", ["The bell"]],
      ["Writing articles", ["Footnotes", "Tag articles with topics"]],
      ["Pages and volumes", ["Volumes"]],
    ])
  })
})

describe("groupSectionsByArea", () => {
  it("puts sections under Reading, Writing, Editing and Development, leaving out empty areas", () => {
    const areas = groupSectionsByArea(
      groupDocsBySection([
        { title: "Moderate comments", section: "moderation" },
        { title: "Footnotes", section: "writing" },
        { title: "Experiments", section: "site" },
        { title: "The bell", section: "getting-started" },
      ]),
    )
    expect(
      areas.map((area) => [area.label, area.sections.map((section) => section.label)]),
    ).toEqual([
      ["Writing", ["Getting started", "Writing articles"]],
      ["Editing", ["Moderation", "Site settings"]],
    ])
  })
})

describe("adjacentDocs", () => {
  const sections = groupDocsBySection([
    { slug: "notifications", title: "The bell", section: "getting-started" },
    { slug: "footnotes", title: "Footnotes", section: "writing" },
    { slug: "topics", title: "Topics", section: "writing" },
  ])
  const slugs = (slug: string) => {
    const { previous, next } = adjacentDocs(sections, slug)
    return [previous?.slug, next?.slug]
  }

  it("follows the sidebar's order across sections", () => {
    expect(slugs("footnotes")).toEqual(["notifications", "topics"])
  })

  it("has no previous doc for the first, nor a next for the last", () => {
    expect(slugs("notifications")).toEqual([undefined, "footnotes"])
    expect(slugs("topics")).toEqual(["footnotes", undefined])
  })

  it("has neither for a doc the sidebar doesn't list", () => {
    expect(slugs("draft")).toEqual([undefined, undefined])
  })
})
