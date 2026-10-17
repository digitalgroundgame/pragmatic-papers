import { describe, expect, it } from "vitest"

import { adjacentDocs, type DocSectionNode, groupDocs } from "../sections"

// As the query returns them, in the order editors gave them: two areas, each with sections.
const nodes: DocSectionNode[] = [
  { id: 1, title: "Reading", slug: "reading" },
  { id: 2, title: "Writing", slug: "writing" },
  { id: 3, title: "Getting started", slug: "getting-started", parent: 2 },
  { id: 4, title: "Articles", slug: "articles", parent: { id: 2 } },
  { id: 5, title: "Editing", slug: "editing" },
  { id: 6, title: "Site settings", slug: "site-settings", parent: 5 },
  { id: 7, title: "Moderation", slug: "moderation", parent: 5 },
]

const outline = (areas: ReturnType<typeof groupDocs<{ title: string }>>) =>
  areas.map((area) => [
    area.title,
    area.sections.map((section) => [section.title, section.docs.map((doc) => doc.title)]),
  ])

describe("groupDocs", () => {
  it("files docs under their areas and sections, in the editors' order, by sidebar name", () => {
    const areas = groupDocs(
      [
        { title: "Tag articles with topics", navTitle: "Topics", section: 4 },
        { title: "Experiments", section: 6 },
        { title: "Footnotes", section: { id: 4 } },
        { title: "Moderate comments", section: 7 },
        { title: "The bell", section: 3 },
      ],
      nodes,
    )
    expect(outline(areas)).toEqual([
      [
        "Writing",
        [
          ["Getting started", ["The bell"]],
          ["Articles", ["Footnotes", "Tag articles with topics"]],
        ],
      ],
      [
        "Editing",
        [
          ["Site settings", ["Experiments"]],
          ["Moderation", ["Moderate comments"]],
        ],
      ],
    ])
    expect(areas[0]!.sections[1]!.key).toBe("articles")
  })

  it("lists docs with no section, or one it can't place, under Other, last", () => {
    const areas = groupDocs(
      [
        { title: "Footnotes", section: 4 },
        { title: "No section", section: null },
        { title: "Under an area", section: 2 },
        { title: "Section deleted", section: 99 },
      ],
      nodes,
    )
    expect(outline(areas)).toEqual([
      ["Writing", [["Articles", ["Footnotes"]]]],
      ["Other", [["Unsorted", ["No section", "Section deleted", "Under an area"]]]],
    ])
  })

  it("leaves out the home doc, which the sidebar links on its own", () => {
    expect(groupDocs([{ slug: "home", title: "Home", section: null }], nodes)).toEqual([])
  })
})

describe("adjacentDocs", () => {
  const areas = groupDocs(
    [
      { slug: "notifications", title: "The bell", section: 3 },
      { slug: "footnotes", title: "Footnotes", section: 4 },
      { slug: "experiments", title: "Experiments", section: 6 },
    ],
    nodes,
  )
  const slugs = (slug: string) => {
    const { previous, next } = adjacentDocs(areas, slug)
    return [previous?.slug, next?.slug]
  }

  it("follows the sidebar's order across sections and areas", () => {
    expect(slugs("footnotes")).toEqual(["notifications", "experiments"])
  })

  it("has no previous doc for the first, nor a next for the last", () => {
    expect(slugs("notifications")).toEqual([undefined, "footnotes"])
    expect(slugs("experiments")).toEqual(["footnotes", undefined])
  })

  it("has neither for a doc the sidebar doesn't list", () => {
    expect(slugs("draft")).toEqual([undefined, undefined])
  })
})
