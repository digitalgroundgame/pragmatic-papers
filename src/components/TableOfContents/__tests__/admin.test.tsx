import { cleanup, render, screen, within } from "@testing-library/react"
import type { CheckboxFieldClientProps } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TableOfContentsCheckbox } from "../admin"
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"

let mockChecked = false
let mockContent: DefaultTypedEditorState | undefined

vi.mock("@payloadcms/ui", () => ({
  CheckboxField: ({ path }: { path: string }) => <input type="checkbox" aria-label={path} />,
  useField: () => ({ value: mockChecked }),
  useFormFields: <T,>(selector: (ctx: [Record<string, { value: unknown }>]) => T) =>
    selector([{ content: { value: mockContent } }]),
}))

function content(children: unknown[]): DefaultTypedEditorState {
  return {
    root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
  } as DefaultTypedEditorState
}

function heading(tag: string, text: string) {
  return { type: "heading", tag, children: [{ type: "text", text }], version: 1 }
}

const props = { path: "showTableOfContents" } as CheckboxFieldClientProps

describe("TableOfContentsCheckbox", () => {
  beforeEach(() => {
    mockChecked = false
    mockContent = undefined
  })

  afterEach(cleanup)

  it("renders only the checkbox while the table of contents is off", () => {
    mockContent = content([heading("h2", "Hidden")])
    render(<TableOfContentsCheckbox {...props} />)

    expect(screen.getByRole("checkbox", { name: "showTableOfContents" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: /preview/i })).not.toBeInTheDocument()
  })

  it("previews the nested entries of the unsaved editor state", () => {
    mockChecked = true
    mockContent = content([
      heading("h2", "Overview"),
      heading("h3", "Details"),
      // A table directly under a heading would fold into it, so text comes first.
      { type: "paragraph", children: [], version: 1 },
      { type: "table", children: [], version: 1 },
    ])
    render(<TableOfContentsCheckbox {...props} />)

    const preview = screen.getByRole("region", { name: "Table of contents preview" })
    const [top] = within(preview).getAllByRole("list")
    const topItems = within(top!).getAllByRole("listitem")
    expect(topItems.filter((li) => li.parentElement === top)).toHaveLength(1)
    const details = within(topItems[0]!).getByText("Details")
    expect(details).toHaveAttribute("title", "#details")
    const table = within(details.closest("li")!).getByText("Table")
    expect(table).toHaveAttribute("title", "#table-1")
  })

  it("prompts for a heading when the editor has no entries", () => {
    mockChecked = true
    mockContent = content([])
    render(<TableOfContentsCheckbox {...props} />)

    expect(screen.getByText("Add a heading to build the table of contents.")).toBeInTheDocument()
  })

  it("handles an editor that has no value yet", () => {
    mockChecked = true
    render(<TableOfContentsCheckbox {...props} />)

    expect(screen.getByText("Add a heading to build the table of contents.")).toBeInTheDocument()
  })
})
