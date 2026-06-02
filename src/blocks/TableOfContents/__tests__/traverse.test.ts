import { describe, expect, it } from "vitest"

import { collectEntries, extractText } from "../traverse"
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical"

function makeState(children: unknown[]): SerializedEditorState {
  return {
    root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
  } as SerializedEditorState
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
})
