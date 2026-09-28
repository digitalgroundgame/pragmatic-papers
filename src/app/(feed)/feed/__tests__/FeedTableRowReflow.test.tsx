import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { LexicalNode } from "../types"
import { makeFeedArticle } from "./fixtures"

vi.mock("@/components/RichText", () => ({
  default: ({ data }: { data: { root: { children: LexicalNode[] } } }) => (
    <span>{data.root.children.map((n) => String(n.text)).join("")}</span>
  ),
}))

const { FeedTableRowReflow } = await import("../blocks/FeedTableRowReflow")

// headerState is a bit field: 1 = column header, 2 = row header.
const cell = (text: string, headerState = 0): LexicalNode => ({
  type: "tablecell",
  headerState,
  children: [{ type: "text", text }],
})
const row = (...cells: LexicalNode[]): LexicalNode => ({ type: "tablerow", children: cells })
const table = (...rows: LexicalNode[]): LexicalNode => ({ type: "table", children: rows })

function renderTable(node: LexicalNode) {
  return render(<>{FeedTableRowReflow({ node, article: makeFeedArticle() })}</>)
}

describe("FeedTableRowReflow", () => {
  it("turns each body row into a card labelled by the header row", () => {
    renderTable(
      table(
        row(cell("State", 1), cell("Margin", 1), cell("Turnout", 1)),
        row(cell("Ohio", 2), cell("+8"), cell("61%")),
      ),
    )

    expect(screen.getAllByRole("article")).toHaveLength(1)
    expect(screen.getByRole("heading", { name: "Ohio" })).toBeInTheDocument()
    expect(screen.getByText("Margin")).toBeInTheDocument()
    expect(screen.getByText("+8")).toBeInTheDocument()
    expect(screen.getByText("Turnout")).toBeInTheDocument()
    expect(screen.queryByText("State")).not.toBeInTheDocument()
  })

  it("numbers the columns of a table with no header row", () => {
    renderTable(table(row(cell("a"), cell("b"))))
    expect(screen.getByText("Column 1")).toBeInTheDocument()
    expect(screen.getByText("Column 2")).toBeInTheDocument()
  })

  it("renders nothing for an empty table", () => {
    const { container } = renderTable(table())
    expect(container).toBeEmptyDOMElement()
  })
})
