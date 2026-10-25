import { createHeadlessEditor } from "@payloadcms/richtext-lexical/lexical/headless"
import { HeadingNode } from "@payloadcms/richtext-lexical/lexical/rich-text"
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical"
import { describe, expect, it } from "vitest"

import { setHeadingTocLabel } from "../headingLabels"

interface Node {
  type: string
  $?: Record<string, unknown>
  children?: Node[]
}

function heading(text: string, state?: Record<string, unknown>) {
  return {
    type: "heading",
    tag: "h2",
    children: [{ type: "text", text, detail: 0, format: 0, mode: "normal", style: "", version: 1 }],
    direction: null,
    format: "",
    indent: 0,
    version: 1,
    ...(state && { $: state }),
  }
}

function editorWith(children: unknown[]) {
  const editor = createHeadlessEditor({
    nodes: [HeadingNode],
    onError: (e) => {
      throw e
    },
  })
  const state = {
    root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
  } as unknown as SerializedEditorState
  editor.setEditorState(editor.parseEditorState(state))
  return editor
}

const saved = (editor: ReturnType<typeof editorWith>) =>
  editor.getEditorState().toJSON().root.children as unknown as Node[]

/** `editor.update` commits on a microtask. */
const flush = () => new Promise((resolve) => setTimeout(resolve))

describe("setHeadingTocLabel", () => {
  it("stores the label on the heading at that index, in its saved state", async () => {
    const editor = editorWith([heading("First"), heading("Michigan Senate – Smith vs Jones")])
    setHeadingTocLabel(editor, 1, "Michigan Senate")
    await flush()

    const [first, second] = saved(editor)
    expect(first!.$).toBeUndefined()
    expect(second!.$).toEqual({ tocLabel: "Michigan Senate" })
  })

  it("drops the label from the saved state when it's emptied", async () => {
    const editor = editorWith([heading("Turnout", { tocLabel: "Votes" })])
    setHeadingTocLabel(editor, 0, "")
    await flush()

    expect(saved(editor)[0]!.$).toBeUndefined()
  })

  it("keeps a saved label through a load and save it doesn't touch", () => {
    const editor = editorWith([heading("Turnout", { tocLabel: "Votes" })])
    expect(saved(editor)[0]!.$).toEqual({ tocLabel: "Votes" })
  })

  it("ignores an index past the last heading", async () => {
    const editor = editorWith([heading("Only")])
    setHeadingTocLabel(editor, 3, "Nope")
    await flush()

    expect(saved(editor)[0]!.$).toBeUndefined()
  })
})
