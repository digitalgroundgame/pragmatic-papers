import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { MediaReference } from "../../references/collectMediaReferences"
import { ReferencesView } from "../ReferencesView"
import { useMediaReferences } from "../useMediaReferences"

let mockId: number | undefined = 42

vi.mock("@payloadcms/ui", () => ({
  useDocumentInfo: () => ({ id: mockId }),
}))

vi.mock("../useMediaReferences", () => ({
  useMediaReferences: vi.fn(),
}))

const reference = (docId: number, docTitle: string, field = "heroImage"): MediaReference => ({
  collection: "articles",
  field,
  docId,
  docTitle,
})

const withReferences = (references: MediaReference[], loading = false) =>
  vi.mocked(useMediaReferences).mockReturnValue({ references, loading })

beforeEach(() => {
  mockId = 42
})

afterEach(() => {
  cleanup()
  vi.mocked(useMediaReferences).mockReset()
})

describe("ReferencesView", () => {
  it("links each document that uses the media", () => {
    withReferences([
      reference(7, "Hero Article"),
      { collection: "users", field: "profileImage", docId: 3, docTitle: "Ada" },
    ])

    render(<ReferencesView />)

    const items = within(screen.getByRole("list")).getAllByRole("listitem")
    expect(items).toHaveLength(2)

    const link = screen.getByRole("link", { name: "Hero Article" })
    expect(link).toHaveAttribute("href", "/admin/collections/articles/7")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"))
    expect(items[1]).toHaveTextContent("User — profile image")
  })

  it("keeps one row per field when a document uses the media twice", () => {
    withReferences([reference(7, "Hero Article"), reference(7, "Hero Article", "meta.image")])

    render(<ReferencesView />)

    expect(screen.getAllByRole("listitem")).toHaveLength(2)
  })

  it("says so when nothing uses the media", () => {
    withReferences([])

    render(<ReferencesView />)

    expect(screen.getByText("Not referenced in any published documents.")).toBeInTheDocument()
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })

  it("shows progress while the references load", () => {
    withReferences([], true)

    render(<ReferencesView />)

    expect(screen.getByRole("status")).toHaveTextContent("Checking references…")
  })

  it("renders nothing on a media upload that isn't saved yet", () => {
    mockId = undefined
    withReferences([])

    const { container } = render(<ReferencesView />)

    expect(container).toBeEmptyDOMElement()
  })
})
