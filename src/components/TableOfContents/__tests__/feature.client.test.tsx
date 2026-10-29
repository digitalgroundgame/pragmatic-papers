import type { ElementNode, SerializedEditorState } from "@payloadcms/richtext-lexical/lexical"
import { $getRoot, createEditor, type LexicalEditor } from "@payloadcms/richtext-lexical/lexical"
import { HeadingNode } from "@payloadcms/richtext-lexical/lexical/rich-text"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TocLabelPlugin } from "../feature.client"

let mockShow = true
let mockEditor: LexicalEditor

vi.mock("@payloadcms/richtext-lexical/client", () => ({
  createClientFeature: (feature: unknown) => feature,
}))
vi.mock("@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [mockEditor],
}))
vi.mock("@payloadcms/ui", () => ({
  useFormFields: <T,>(selector: (ctx: [Record<string, { value: unknown }>]) => T) =>
    selector([{ showTableOfContents: { value: mockShow } }]),
}))

function node(type: string, text: string, state?: Record<string, unknown>) {
  return {
    type,
    tag: "h2",
    children: [{ type: "text", text, detail: 0, format: 0, mode: "normal", style: "", version: 1 }],
    direction: null,
    format: "",
    indent: 0,
    version: 1,
    ...(state && { $: state }),
  }
}

function load(children: unknown[]) {
  mockEditor = createEditor({
    nodes: [HeadingNode],
    onError: (error) => {
      throw error
    },
  })
  // A mounted editor, so the plugin can find the heading's element to sit under.
  const root = document.createElement("div")
  root.contentEditable = "true"
  document.body.append(root)
  mockEditor.setRootElement(root)
  mockEditor.setEditorState(
    mockEditor.parseEditorState({
      root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
    } as unknown as SerializedEditorState),
  )
}

function selectIn(index: number) {
  act(() =>
    mockEditor.update(() => ($getRoot().getChildren()[index] as ElementNode).selectEnd(), {
      discrete: true,
    }),
  )
}

const savedState = (index: number) =>
  (mockEditor.getEditorState().toJSON().root.children[index] as { $?: unknown }).$

describe("TocLabelPlugin", () => {
  beforeEach(() => {
    mockShow = true
    load([
      node("paragraph", "Body"),
      node("heading", "Michigan Senate – Smith vs Jones"),
      node("heading", "Turnout", { tocLabel: "Votes" }),
    ])
  })

  afterEach(() => {
    cleanup()
    document.body.replaceChildren()
  })

  const renderPlugin = () =>
    render(<TocLabelPlugin anchorElem={document.body} clientProps={undefined} />)

  const openBox = () => {
    fireEvent.click(screen.getByRole("button", { name: /table of contents label/i }))
    return screen.getByRole("textbox", { name: "In the table of contents" })
  }

  it("shows nothing until the cursor is in a heading", () => {
    renderPlugin()
    selectIn(0)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("shows only a small button in a heading, which opens the label box", () => {
    renderPlugin()
    selectIn(1)

    const toggle = screen.getByRole("button", {
      name: "Give this heading a shorter table of contents label",
    })
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()

    fireEvent.click(toggle)
    const box = screen.getByRole("textbox", { name: "In the table of contents" })
    expect(box).toHaveFocus()
    expect(box).toHaveValue("")
    expect(box).toHaveAttribute("placeholder", "Michigan Senate – Smith vs Jones")
  })

  it("shows a heading's saved label on its button and in the box", () => {
    renderPlugin()
    selectIn(2)
    const toggle = screen.getByRole("button", { name: "Table of contents label: Votes. Change it" })
    expect(toggle).toHaveTextContent("Votes")
    expect(openBox()).toHaveValue("Votes")
  })

  it("closes the box when the cursor moves to another heading", () => {
    renderPlugin()
    selectIn(2)
    openBox()
    act(() => screen.getByRole("textbox").blur())

    selectIn(1)
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.getByRole("button")).toHaveAccessibleName(/Give this heading/)
  })

  it("writes what's typed onto the heading, keeping it while the writer types", async () => {
    renderPlugin()
    selectIn(1)
    const box = openBox()

    fireEvent.change(box, { target: { value: "Michigan Senate" } })
    await act(() => new Promise((resolve) => setTimeout(resolve)))

    expect(screen.getByRole("textbox")).toHaveValue("Michigan Senate")
    expect(savedState(1)).toEqual({ tocLabel: "Michigan Senate" })
  })

  it("closes the box and hands the cursor back to the editor on Enter", () => {
    const focus = vi.spyOn(mockEditor, "focus").mockImplementation(() => undefined)
    renderPlugin()
    selectIn(1)

    fireEvent.keyDown(openBox(), { key: "Enter" })
    expect(focus).toHaveBeenCalled()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("stays out of the way while the table of contents is off", () => {
    mockShow = false
    renderPlugin()
    selectIn(1)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
