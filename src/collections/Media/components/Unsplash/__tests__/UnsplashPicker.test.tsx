import { act, fireEvent, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { UnsplashPhoto } from "@/integrations/unsplash"

import { isPickedFile } from "../pickedFiles"
import { UnsplashPicker } from "../UnsplashPicker"
import type { PickUnsplashPhoto, SearchUnsplash } from "../UnsplashSearch"

const ui = vi.hoisted(() => ({
  alt: undefined as unknown,
  openModal: vi.fn(),
  closeModal: vi.fn(),
  setUploadControlFile: vi.fn(),
  dispatchFields: vi.fn(),
}))

vi.mock("@payloadcms/ui", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick} type="button">
      {children}
    </button>
  ),
  Drawer: ({ children, slug }: { children: React.ReactNode; slug: string }) => (
    <div data-slug={slug}>{children}</div>
  ),
  useDrawerSlug: (slug: string) => `drawer_1_${slug}`,
  useModal: () => ({ openModal: ui.openModal, closeModal: ui.closeModal }),
  useUploadControls: () => ({ setUploadControlFile: ui.setUploadControlFile }),
  useForm: () => ({ dispatchFields: ui.dispatchFields }),
  useFormFields: (select: (ctx: [Record<string, { value: unknown }>]) => unknown) =>
    select([{ alt: { value: ui.alt } }]),
}))

// The search UI has its own tests; here it's a seam to reach the picker's callbacks.
const seam = vi.hoisted(() => ({
  search: null as SearchUnsplash | null,
  onPick: null as PickUnsplashPhoto | null,
}))
vi.mock("../UnsplashSearch", () => ({
  UnsplashSearch: (props: { search: SearchUnsplash; onPick: PickUnsplashPhoto }) => {
    seam.search = props.search
    seam.onPick = props.onPick
    return null
  },
}))

const photo = {
  id: "abc123",
  alt: "a lighthouse at dusk",
  photographer: { username: "ada" },
} as UnsplashPhoto

const fetchMock = vi.fn()

beforeEach(() => {
  ui.alt = undefined
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("UnsplashPicker", () => {
  it("opens its drawer from the Search Unsplash button", () => {
    render(<UnsplashPicker />)
    fireEvent.click(screen.getByRole("button", { name: "Search Unsplash" }))
    expect(ui.openModal).toHaveBeenCalledWith("drawer_1_unsplash")
  })

  it("searches through Media's endpoint with the editor's session", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ total: 0, totalPages: 0, results: [] }),
    )
    render(<UnsplashPicker />)

    await seam.search!("dusk sky", 2, "landscape")
    await seam.search!("dusk", 1, "")

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/media/unsplash/search?query=dusk+sky&page=2&orientation=landscape",
      { credentials: "include" },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/media/unsplash/search?query=dusk&page=1", {
      credentials: "include",
    })
  })

  it("passes the endpoint's error on, or a fallback naming the status", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: "Search for something." }, { status: 400 }),
    )
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 504 }))
    render(<UnsplashPicker />)

    await expect(seam.search!("x", 1, "")).rejects.toThrow("Search for something.")
    await expect(seam.search!("x", 1, "")).rejects.toThrow("Searching Unsplash failed (HTTP 504).")
  })

  it("hands the photo to the upload form as its file, with the id and alt text", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/jpeg" } }),
    )
    render(<UnsplashPicker />)

    await act(() => seam.onPick!(photo))

    expect(fetchMock).toHaveBeenCalledWith("/api/media/unsplash/abc123/file", {
      credentials: "include",
    })
    const file = ui.setUploadControlFile.mock.calls[0]![0] as File
    expect(file.name).toBe("unsplash-ada-abc123.jpg")
    expect(file.type).toBe("image/jpeg")
    expect(isPickedFile("abc123", file)).toBe(true)
    expect(ui.dispatchFields).toHaveBeenCalledWith({
      type: "UPDATE",
      path: "unsplashId",
      value: "abc123",
    })
    expect(ui.dispatchFields).toHaveBeenCalledWith({
      type: "UPDATE",
      path: "alt",
      value: "a lighthouse at dusk",
    })
    expect(ui.closeModal).toHaveBeenCalledWith("drawer_1_unsplash")
  })

  it("keeps alt text the editor already wrote", async () => {
    ui.alt = "Their words"
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3])))
    render(<UnsplashPicker />)

    await act(() => seam.onPick!(photo))

    const paths = ui.dispatchFields.mock.calls.map(([action]) => (action as { path: string }).path)
    expect(paths).toEqual(["unsplashId"])
    // A blob without a type is still saved as a JPEG, which is what the endpoint serves.
    expect((ui.setUploadControlFile.mock.calls[0]![0] as File).type).toBe("image/jpeg")
  })

  it("leaves the form alone when the download fails", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: "Unsplash download failed. Try again in a moment." }, { status: 502 }),
    )
    render(<UnsplashPicker />)

    await expect(seam.onPick!(photo)).rejects.toThrow("Unsplash download failed.")
    expect(ui.setUploadControlFile).not.toHaveBeenCalled()
    expect(ui.dispatchFields).not.toHaveBeenCalled()
    expect(ui.closeModal).not.toHaveBeenCalled()
  })
})
