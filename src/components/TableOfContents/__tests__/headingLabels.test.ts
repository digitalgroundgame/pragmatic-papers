import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical"
import { $getRoot, type ElementNode } from "@payloadcms/richtext-lexical/lexical"
import { createHeadlessEditor } from "@payloadcms/richtext-lexical/lexical/headless"
import { HeadingNode } from "@payloadcms/richtext-lexical/lexical/rich-text"
import { describe, expect, it } from "vitest"

import { $selectedHeading, setHeadingTocLabel } from "../headingLabels"

interface Node {
  type: string
  $?: Record<string, unknown>
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

function paragraph(text: string) {
  return { ...heading(text), type: "paragraph", tag: undefined, textFormat: 0, textStyle: "" }
}

function editorWith(children: unknown[]) {
  const editor = createHeadlessEditor({
    nodes: [HeadingNode],
    onError: (error) => {
      throw error
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

const keyOf = (editor: ReturnType<typeof editorWith>, index: number) =>
  editor.getEditorState().read(() => $getRoot().getChildren()[index]!.getKey())

/** Puts the cursor in the `index`th top-level node. */
function selectIn(editor: ReturnType<typeof editorWith>, index: number) {
  editor.update(() => ($getRoot().getChildren()[index] as ElementNode).selectEnd(), {
    discrete: true,
  })
}

describe("setHeadingTocLabel", () => {
  it("stores the label on that heading, in its saved state", () => {
    const editor = editorWith([heading("First"), heading("Michigan Senate – Smith vs Jones")])
    setHeadingTocLabel(editor, keyOf(editor, 1), "Michigan Senate")
    editor.update(() => undefined, { discrete: true })

    const [first, second] = saved(editor)
    expect(first!.$).toBeUndefined()
    expect(second!.$).toEqual({ tocLabel: "Michigan Senate" })
  })

  it("drops the label from the saved state when it's emptied", () => {
    const editor = editorWith([heading("Turnout", { tocLabel: "Votes" })])
    setHeadingTocLabel(editor, keyOf(editor, 0), "")
    editor.update(() => undefined, { discrete: true })

    expect(saved(editor)[0]!.$).toBeUndefined()
  })

  it("keeps a saved label through a load and save it doesn't touch", () => {
    const editor = editorWith([heading("Turnout", { tocLabel: "Votes" })])
    expect(saved(editor)[0]!.$).toEqual({ tocLabel: "Votes" })
  })

  it("leaves anything that isn't a heading alone", () => {
    const editor = editorWith([paragraph("Body")])
    setHeadingTocLabel(editor, keyOf(editor, 0), "Nope")
    editor.update(() => undefined, { discrete: true })

    expect(saved(editor)[0]!.$).toBeUndefined()
  })
})

describe("$selectedHeading", () => {
  it("is the heading the cursor is in, with its text and label", () => {
    const editor = editorWith([paragraph("Body"), heading(" Turnout ", { tocLabel: "Votes" })])
    selectIn(editor, 1)

    expect(editor.getEditorState().read($selectedHeading)).toEqual({
      key: keyOf(editor, 1),
      text: "Turnout",
      label: "Votes",
    })
  })

  it("is null in anything else, or with no selection", () => {
    const editor = editorWith([paragraph("Body"), heading("Turnout")])
    expect(editor.getEditorState().read($selectedHeading)).toBeNull()

    selectIn(editor, 0)
    expect(editor.getEditorState().read($selectedHeading)).toBeNull()
  })
})
