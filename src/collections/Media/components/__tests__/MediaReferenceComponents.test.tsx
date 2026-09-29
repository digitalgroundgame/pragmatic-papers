import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
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

const setReferences = vi.fn()

const withReferences = (references: MediaReference[], loading = false) =>
  vi.mocked(useMediaReferences).mockReturnValue({ references, loading, setReferences })

const fetchMock = vi.fn()

beforeEach(() => {
  mockId = 42
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  cleanup()
  vi.mocked(useMediaReferences).mockReset()
  setReferences.mockReset()
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

const respondWith = (status: number, body: unknown) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }))

const startDetach = (name: RegExp) => {
  fireEvent.click(screen.getByRole("button", { name }))
  fireEvent.click(screen.getByRole("button", { name: "Detach and publish" }))
}

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

  describe("detach", () => {
    it("asks before publishing, and can be cancelled", () => {
      withReferences([reference(7, "Hero Article")])
      render(<ReferencesView />)

      fireEvent.click(screen.getByRole("button", { name: "Detach from Hero Article (hero image)" }))

      expect(
        screen.getByRole("group", { name: "Confirm detaching from Hero Article" }),
      ).toHaveTextContent("Remove it from the article hero image and publish “Hero Article”?")
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
      expect(screen.queryByRole("group")).not.toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("detaches the reference and shows the list that's left", async () => {
      const left = [reference(8, "Other Article")]
      withReferences([reference(7, "Hero Article", "content (mediaBlock)")])
      respondWith(200, { references: left })
      render(<ReferencesView />)

      startDetach(/Detach from Hero Article/)

      await waitFor(() => expect(setReferences).toHaveBeenCalledWith(left))
      expect(fetchMock).toHaveBeenCalledWith("/api/media/42/detach", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: "articles",
          docId: 7,
          field: "content (mediaBlock)",
        }),
      })
    })

    it("shows why a detach was refused, keeping the row", async () => {
      withReferences([reference(7, "Hero Article")])
      respondWith(409, { error: "This document has unpublished changes." })
      render(<ReferencesView />)

      startDetach(/Detach from Hero Article/)

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "This document has unpublished changes.",
      )
      expect(setReferences).not.toHaveBeenCalled()
      expect(screen.getByRole("button", { name: /Detach from Hero Article/ })).toBeInTheDocument()
    })

    it("refreshes the list a refused detach still returns", async () => {
      const current = [reference(7, "Hero Article", "meta.image")]
      withReferences(current)
      respondWith(409, { error: "Detach that one first.", references: current })
      render(<ReferencesView />)

      startDetach(/Detach from Hero Article/)

      expect(await screen.findByRole("alert")).toHaveTextContent("Detach that one first.")
      expect(setReferences).toHaveBeenCalledWith(current)
    })

    it("reports a failure with no message by its status", async () => {
      withReferences([reference(7, "Hero Article")])
      fetchMock.mockResolvedValue(new Response("oops", { status: 502 }))
      render(<ReferencesView />)

      startDetach(/Detach from Hero Article/)

      expect(await screen.findByRole("alert")).toHaveTextContent("Detaching failed (HTTP 502).")
    })

    it("disables the confirmation while it publishes", async () => {
      withReferences([reference(7, "Hero Article")])
      fetchMock.mockReturnValue(new Promise(() => undefined))
      render(<ReferencesView />)

      startDetach(/Detach from Hero Article/)

      expect(await screen.findByRole("button", { name: "Publishing…" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    })
  })
})
