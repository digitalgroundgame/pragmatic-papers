import { describe, expect, it } from "vitest"

import { collectEntries, extractText, stampAnchors } from "../traverse"
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical"

function makeState(children: unknown[]): SerializedEditorState {
  return stampAnchors({
    root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
  } as SerializedEditorState)
}

function heading(tag: string, text: string) {
  return {
    type: "heading",
    tag,
    children: [{ type: "text", text, version: 1 } as object],
    direction: null,
    format: "",
    indent: 0,
    version: 1,
  } as object
}

function block(blockType: string, fields: Record<string, unknown> = {}) {
  return {
    type: "block",
    fields: { blockType, ...fields },
    version: 2,
  } as object
}

describe("extractText", () => {
  it("extracts flat text node", () => {
    expect(extractText([{ type: "text", text: "Hello" }])).toBe("Hello")
  })

  it("concatenates nested text", () => {
    const nodes = [
      {
        type: "paragraph",
        children: [
          { type: "text", text: "A" },
          { type: "text", text: "B" },
        ],
      },
    ]
    expect(extractText(nodes)).toBe("AB")
  })

  it("returns empty string for undefined", () => {
    expect(extractText(undefined)).toBe("")
  })

  it("ignores nodes with neither text nor children (e.g. linebreak)", () => {
    expect(extractText([{ type: "linebreak" }, { type: "text", text: "ok" }])).toBe("ok")
  })

  it("treats a text node missing its text field as empty", () => {
    expect(extractText([{ type: "text" }, { type: "text", text: "hi" }])).toBe("hi")
  })
})

describe("stampAnchors", () => {
  const raw = (children: unknown[]) =>
    ({
      root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
    }) as unknown as SerializedEditorState
  const anchorsOf = (state: SerializedEditorState) =>
    (state.root.children as { anchor?: string }[]).map((n) => n.anchor)

  it("slugifies heading text into an anchor", () => {
    expect(anchorsOf(stampAnchors(raw([heading("h2", "My Section")])))).toEqual(["my-section"])
  })

  it("suffixes duplicate heading anchors", () => {
    const state = stampAnchors(raw([heading("h2", "Same"), heading("h3", "Same")]))
    expect(anchorsOf(state)).toEqual(["same", "same-2"])
  })

  it('gives a table and a heading reading "Table 1" different ids, either order', () => {
    const table = { type: "table", children: [] }
    expect(anchorsOf(stampAnchors(raw([heading("h2", "Table 1"), table])))).toEqual([
      "table-1",
      "table-2",
    ])
    expect(anchorsOf(stampAnchors(raw([table, heading("h2", "Table 1")])))).toEqual([
      "table-1",
      "table-1-2",
    ])
  })

  it("suffixes a heading that would take a reserved id", () => {
    const state = stampAnchors(raw([heading("h2", "Intro")]), undefined, undefined, ["intro"])
    expect(anchorsOf(state)).toEqual(["intro-2"])
  })

  it("falls back to 'heading' when the text slugifies to nothing", () => {
    expect(anchorsOf(stampAnchors(raw([heading("h2", "!!!")])))).toEqual(["heading"])
  })

  it("numbers tables in document order, including nested ones", () => {
    const state = stampAnchors(
      raw([
        { type: "table", children: [] },
        { type: "paragraph", children: [] },
        { type: "listitem", children: [{ type: "table", children: [] }] },
      ]),
    )
    const [first, , item] = state.root.children as {
      anchor?: string
      children?: { anchor?: string }[]
    }[]
    expect(first!.anchor).toBe("table-1")
    expect(item!.children![0]!.anchor).toBe("table-2")
  })

  it("leaves other nodes unanchored", () => {
    const state = stampAnchors(raw([{ type: "paragraph", children: [] }]))
    expect(anchorsOf(state)).toEqual([undefined])
  })

  it("uses the supplied slugify function", () => {
    const state = stampAnchors(raw([heading("h2", "Hi")]), (t) => `x-${t}`)
    expect(anchorsOf(state)).toEqual(["x-Hi"])
  })

  it("overwrites a stale anchor after the heading text changes", () => {
    const stale = { ...heading("h2", "New title"), anchor: "old-title" }
    expect(anchorsOf(stampAnchors(raw([stale])))).toEqual(["new-title"])
  })

  it("stamps resolver-matched blocks from their label, sharing the heading namespace", () => {
    const resolvers = { map: () => ({ label: "Overview" }) }
    const state = stampAnchors(
      raw([heading("h2", "Overview"), block("map"), block("map"), block("other")]),
      undefined,
      resolvers,
    )
    expect(anchorsOf(state)).toEqual(["overview", "overview-2", "overview-3", undefined])
  })

  it("leaves blocks whose resolver supplies its own anchor or skips them unstamped", () => {
    const resolvers = {
      own: () => ({ label: "Own", anchor: "custom" }),
      skipped: () => null,
    }
    const stale = { ...block("skipped"), anchor: "stale" }
    const state = stampAnchors(raw([block("own"), stale]), undefined, resolvers)
    expect(anchorsOf(state)).toEqual([undefined, undefined])
  })

  it("does not mutate its input", () => {
    const input = raw([heading("h2", "Keep")])
    stampAnchors(input)
    expect(anchorsOf(input)).toEqual([undefined])
  })
})

describe("collectEntries – headings only", () => {
  it("returns entries for h2/h3/h4", () => {
    const state = makeState([
      heading("h2", "Intro"),
      heading("h3", "Details"),
      heading("h4", "Notes"),
    ])
    const entries = collectEntries(state)
    expect(entries).toHaveLength(3)
    expect(entries[0]!).toMatchObject({ label: "Intro", anchor: "intro", depth: 1 })
    expect(entries[1]!).toMatchObject({ label: "Details", anchor: "details", depth: 2 })
    expect(entries[2]!).toMatchObject({ label: "Notes", anchor: "notes", depth: 3 })
  })

  it("nests a depthless entry under the heading before it", () => {
    const paragraph = { type: "paragraph", children: [] } as object
    const state = makeState([
      { type: "table", children: [] } as object,
      heading("h2", "Section"),
      heading("h3", "Subsection"),
      paragraph,
      { type: "table", children: [] } as object,
      heading("h2", "Next"),
      paragraph,
      { type: "table", children: [] } as object,
    ])
    const depths = collectEntries(state).map((entry) => [entry.label, entry.depth])
    expect(depths).toEqual([
      ["Table", 1],
      ["Section", 1],
      ["Subsection", 2],
      ["Table", 3],
      ["Next", 1],
      ["Table", 2],
    ])
  })

  it("folds a table directly under a heading into the heading's entry", () => {
    const state = makeState([
      heading("h2", "Budget"),
      { type: "table", children: [] } as object,
      heading("h2", "Races"),
      { type: "paragraph", children: [] } as object,
      { type: "table", children: [] } as object,
    ])
    const entries = collectEntries(state)
    expect(entries.map((entry) => entry.label)).toEqual(["Budget", "Races", "Table"])
    // The heading takes the table's icon, and keeps its own anchor.
    expect(entries[0]).toMatchObject({ anchor: "budget", icon: expect.anything() })
    expect(entries[1]!.icon).toBeUndefined()
  })

  it("keeps a table that follows a heading's table as its own entry", () => {
    const state = makeState([
      heading("h2", "Budget"),
      { type: "table", children: [] } as object,
      { type: "table", children: [] } as object,
    ])
    expect(collectEntries(state).map((entry) => entry.label)).toEqual(["Budget", "Table"])
  })

  it("keeps a depth the resolver sets explicitly", () => {
    const state = makeState([heading("h3", "Deep"), block("pinned", { id: "p" })])
    const entries = collectEntries(state, {
      pinned: () => ({ label: "Pinned", anchor: "p", depth: 1 }),
    })
    expect(entries[1]).toMatchObject({ label: "Pinned", depth: 1 })
  })

  it("disambiguates duplicate heading text", () => {
    const state = makeState([heading("h2", "Overview"), heading("h2", "Overview")])
    const entries = collectEntries(state)
    expect(entries[0]!.anchor).toBe("overview")
    expect(entries[1]!.anchor).toBe("overview-2")
  })

  it("returns empty array for empty state", () => {
    const state = makeState([])
    expect(collectEntries(state)).toHaveLength(0)
  })
})

describe("collectEntries – caller resolvers", () => {
  it("includes a caller-registered block type", () => {
    const state = makeState([
      heading("h2", "Start"),
      block("customWidget", { id: "widget-1", name: "My Widget" }),
    ])
    const entries = collectEntries(state, {
      customWidget: (fields) => {
        const f = fields as { id: string; name: string }
        return { label: f.name, anchor: f.id, depth: 1 }
      },
    })
    expect(entries).toHaveLength(2)
    expect(entries[1]!).toMatchObject({ label: "My Widget", anchor: "widget-1" })
  })

  it("returns null from caller resolver to skip a block", () => {
    const state = makeState([heading("h2", "Title"), block("math", { id: "m1" })])
    const entries = collectEntries(state, {
      math: () => null,
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]!.label).toBe("Title")
  })

  it("caller resolver overrides built-in heading resolver", () => {
    const state = makeState([heading("h2", "Override me")])
    const entries = collectEntries(state, {
      heading: () => ({ label: "Custom Label", anchor: "custom", depth: 1 }),
    })
    expect(entries[0]!.label).toBe("Custom Label")
  })

  it("skips block nodes with no blockType (empty resolver key)", () => {
    const state = makeState([heading("h2", "Heading"), { type: "block", fields: {} } as object])
    const entries = collectEntries(state)
    expect(entries).toHaveLength(1)
    expect(entries[0]!.label).toBe("Heading")
  })

  it("falls back to 'heading' anchor when heading text is empty", () => {
    const state = makeState([heading("h2", "")])
    const entries = collectEntries(state, {
      heading: (node) => {
        const h = node as { children?: { text?: string }[] }
        return { label: h.children?.[0]?.text ?? "n/a", anchor: "anchored", depth: 1 }
      },
    })
    expect(entries).toHaveLength(1)
  })

  it("falls back to the stamped anchor when a resolver omits one", () => {
    const state = { root: { children: [{ ...block("map"), anchor: "the-map" }] } }
    const entries = collectEntries(state as unknown as SerializedEditorState, {
      map: () => ({ label: "Map" }),
    })
    expect(entries).toEqual([{ label: "Map", anchor: "the-map", depth: 1 }])
  })

  it("skips a block that has neither a resolver anchor nor a stamped one", () => {
    const entries = collectEntries(makeState([block("map")]), { map: () => ({ label: "Map" }) })
    expect(entries).toEqual([])
  })

  it("traverses nested block children (e.g. inlineBlock inside paragraph)", () => {
    const state = makeState([
      {
        type: "paragraph",
        children: [{ type: "inlineBlock", fields: { blockType: "callout", id: "i1" } }],
      } as object,
    ])
    const entries = collectEntries(state, {
      callout: (fields) => {
        const f = fields as { id: string }
        return { label: "Callout", anchor: f.id }
      },
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]!.anchor).toBe("i1")
  })
})
