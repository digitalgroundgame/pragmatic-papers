import { cleanup, render, screen, within } from "@testing-library/react"
import type { CheckboxFieldClientProps } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TableOfContentsCheckbox } from "../admin"
import { stampAnchors } from "../traverse"
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"

let mockChecked = false
let mockSavedDocumentData: Record<string, unknown> | undefined

vi.mock("@payloadcms/ui", () => ({
  CheckboxField: ({ path }: { path: string }) => <input type="checkbox" aria-label={path} />,
  useDocumentInfo: () => ({ savedDocumentData: mockSavedDocumentData }),
  useField: () => ({ value: mockChecked }),
}))

function content(children: unknown[]): DefaultTypedEditorState {
  return stampAnchors({
    root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
  } as DefaultTypedEditorState)
}

function heading(tag: string, text: string) {
  return { type: "heading", tag, children: [{ type: "text", text }], version: 1 }
}

const props = { path: "showTableOfContents" } as CheckboxFieldClientProps

describe("TableOfContentsCheckbox", () => {
  beforeEach(() => {
    mockChecked = false
    mockSavedDocumentData = undefined
  })

  afterEach(cleanup)

  it("renders only the checkbox while the table of contents is off", () => {
    mockSavedDocumentData = { content: content([heading("h2", "Hidden")]) }
    render(<TableOfContentsCheckbox {...props} />)

    expect(screen.getByRole("checkbox", { name: "showTableOfContents" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: /preview/i })).not.toBeInTheDocument()
  })

  it("previews the nested entries of the last saved draft", () => {
    mockChecked = true
    mockSavedDocumentData = {
      content: content([
        heading("h2", "Overview"),
        heading("h3", "Details"),
        { type: "table", children: [], version: 1 },
      ]),
    }
    render(<TableOfContentsCheckbox {...props} />)

    const preview = screen.getByRole("region", { name: "Table of contents preview" })
    const [top] = within(preview).getAllByRole("list")
    const topItems = within(top!).getAllByRole("listitem")
    expect(topItems.filter((li) => li.parentElement === top)).toHaveLength(2)
    expect(within(topItems[0]!).getByText("Details")).toHaveAttribute("title", "#details")
    expect(within(preview).getByText("Table")).toHaveAttribute("title", "#table-1")
  })

  it("prompts for a heading when the saved draft has no entries", () => {
    mockChecked = true
    mockSavedDocumentData = { content: content([]) }
    render(<TableOfContentsCheckbox {...props} />)

    expect(screen.getByText("Add a heading to build the table of contents.")).toBeInTheDocument()
  })

  it("handles a document that has not been saved yet", () => {
    mockChecked = true
    render(<TableOfContentsCheckbox {...props} />)

    expect(screen.getByText("Add a heading to build the table of contents.")).toBeInTheDocument()
  })
})
