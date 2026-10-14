import { describe, expect, it } from "vitest"

import { adjacentDocs, groupDocsBySection, groupSectionsByArea } from "../sections"

describe("groupDocsBySection", () => {
  it("groups docs in the sidebar's order, by sidebar name, leaving out empty sections", () => {
    const groups = groupDocsBySection([
      { title: "Tag articles with topics", navTitle: "Topics", section: "articles" },
      { title: "Volumes", section: "pages-and-volumes" },
      { title: "Footnotes", section: "articles" },
      { title: "The bell", section: null },
    ])
    expect(groups.map((group) => [group.label, group.docs.map((doc) => doc.title)])).toEqual([
      ["Getting started", ["The bell"]],
      ["Articles", ["Footnotes", "Tag articles with topics"]],
      ["Pages and volumes", ["Volumes"]],
    ])
  })
})

describe("groupSectionsByArea", () => {
  it("puts sections under Reading, Writing, Editing and Development, leaving out empty areas", () => {
    const areas = groupSectionsByArea(
      groupDocsBySection([
        { title: "Moderate comments", section: "moderation" },
        { title: "Footnotes", section: "articles" },
        { title: "Experiments", section: "site-settings" },
        { title: "The bell", section: "getting-started" },
      ]),
    )
    expect(
      areas.map((area) => [area.label, area.sections.map((section) => section.label)]),
    ).toEqual([
      ["Writing", ["Getting started", "Articles"]],
      ["Editing", ["Moderation", "Site settings"]],
    ])
  })
})

describe("adjacentDocs", () => {
  const sections = groupDocsBySection([
    { slug: "notifications", title: "The bell", section: "getting-started" },
    { slug: "footnotes", title: "Footnotes", section: "articles" },
    { slug: "topics", title: "Topics", section: "articles" },
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
