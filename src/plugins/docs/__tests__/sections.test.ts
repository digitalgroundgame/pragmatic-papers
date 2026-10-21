import { describe, expect, it } from "vitest"

import {
  adjacentDocs,
  docAudiences,
  docLineage,
  docPaths,
  docsInOrder,
  docsTree,
  type DocsNode,
  docURL,
  parentIds,
  type TreeDoc,
} from "../sections"

// As the query returns them (newest first, so not in the tree's order): two areas, their
// sections, and docs, with `_order` as editors dragged them.
const docs: TreeDoc[] = [
  { id: 11, slug: "footnotes", title: "Footnotes", parent: 4, _order: "a1" },
  {
    id: 12,
    slug: "topics",
    title: "Tag articles with topics",
    navTitle: "Topics",
    parent: 4,
    _order: "a2",
  },
  { id: 13, slug: "notifications", title: "The bell", parent: { id: 3 } },
  { id: 14, slug: "experiments", title: "Experiments", parent: 6 },
  { id: 1, slug: "home", title: "Pragmatic Papers docs" },
  { id: 2, slug: "writing", title: "Writing", parent: null, _order: "a0" },
  { id: 3, slug: "getting-started", title: "Getting started", parent: 2, _order: "a0" },
  { id: 4, slug: "articles", title: "Articles", parent: 2, _order: "a1" },
  { id: 5, slug: "editing", title: "Editing", parent: null, _order: "a1" },
  { id: 6, slug: "site-settings", title: "Site settings", parent: 5 },
]

const outline = (nodes: DocsNode<TreeDoc>[]): unknown[] =>
  nodes.map((node) =>
    node.children.length ? [node.doc.title, outline(node.children)] : node.doc.title,
  )

describe("docURL", () => {
  it("joins the slugs under /docs, with the home doc at /docs", () => {
    expect(docURL(["writing", "articles", "footnotes"])).toBe("/docs/writing/articles/footnotes")
    expect(docURL(["home"])).toBe("/docs")
    expect(docURL([])).toBe("/docs")
    expect(docURL(["writing", null, "footnotes"])).toBe("/docs/writing/footnotes")
  })
})

describe("docsTree", () => {
  const tree = docsTree(docs)

  it("nests docs under their parents, in the editors' order, then by sidebar name", () => {
    expect(outline(tree)).toEqual([
      [
        "Writing",
        [
          ["Getting started", ["The bell"]],
          ["Articles", ["Footnotes", "Tag articles with topics"]],
        ],
      ],
      ["Editing", [["Site settings", ["Experiments"]]]],
    ])
  })

  it("gives each doc the address its place in the tree makes", () => {
    const paths = docPaths(tree)
    expect(paths.get("footnotes")).toBe("/docs/writing/articles/footnotes")
    expect(paths.get("writing")).toBe("/docs/writing")
    expect(paths.get("home")).toBe("/docs")
  })

  it("puts a doc whose parent isn't published, or that loops, at the top", () => {
    const loose = docsTree([
      { id: 1, slug: "orphan", title: "Orphan", parent: 99 },
      { id: 2, slug: "self", title: "Self", parent: 2 },
      { id: 3, slug: "a", title: "A", parent: 4 },
      { id: 4, slug: "b", title: "B", parent: 3 },
    ])
    expect(docsInOrder(loose).map((node) => node.doc.slug)).toEqual(
      expect.arrayContaining(["orphan", "self", "a", "b"]),
    )
    expect(loose.find((node) => node.doc.slug === "orphan")?.path).toBe("/docs/orphan")
    expect(loose.find((node) => node.doc.slug === "self")?.path).toBe("/docs/self")
  })

  it("leaves out the home doc, which the sidebar links on its own", () => {
    expect(docsTree([{ id: 1, slug: "home", title: "Home" }])).toEqual([])
  })
})

describe("docLineage and parentIds", () => {
  const tree = docsTree(docs)

  it("finds a doc and its ancestors, top first", () => {
    expect(docLineage(tree, "footnotes").map((node) => node.doc.slug)).toEqual([
      "writing",
      "articles",
      "footnotes",
    ])
    expect(docLineage(tree, "draft")).toEqual([])
  })

  it("names the docs others sit under", () => {
    expect([...parentIds(tree)].sort()).toEqual(["2", "3", "4", "5", "6"])
  })
})

describe("docAudiences", () => {
  it("gives a doc without an audience the nearest one above it", () => {
    const withAudiences = docs.map((doc) =>
      doc.slug === "writing"
        ? { ...doc, audience: ["writer", "editor"] }
        : doc.slug === "editing"
          ? { ...doc, audience: ["editor"] }
          : doc.slug === "topics"
            ? { ...doc, audience: ["admin"] }
            : doc,
    )
    const audiences = docAudiences(docsTree(withAudiences))
    // Footnotes sits two levels under Writing; Experiments under Editing's Site settings.
    expect(audiences.get("11")).toEqual(["writer", "editor"])
    expect(audiences.get("14")).toEqual(["editor"])
    // Its own audience wins, and a doc with none above it is for all staff.
    expect(audiences.get("12")).toEqual(["admin"])
    expect(docAudiences(docsTree(docs)).get("11")).toEqual([])
  })
})

describe("adjacentDocs", () => {
  const tree = docsTree(docs)
  const home = docs.find((doc) => doc.slug === "home")
  const slugs = (slug: string) => {
    const { previous, next } = adjacentDocs(tree, slug, home)
    return [previous?.slug, next?.slug]
  }

  it("follows the sidebar's order, each doc before the ones under it", () => {
    expect(slugs("articles")).toEqual(["notifications", "footnotes"])
    expect(slugs("topics")).toEqual(["footnotes", "editing"])
  })

  it("starts at the home doc, and has no next for the last", () => {
    expect(slugs("home")).toEqual([undefined, "writing"])
    expect(slugs("experiments")).toEqual(["site-settings", undefined])
  })

  it("has neither for a doc the sidebar doesn't list", () => {
    expect(slugs("draft")).toEqual([undefined, undefined])
  })
})
