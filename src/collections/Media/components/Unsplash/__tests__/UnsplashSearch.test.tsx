import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { UnsplashPhoto } from "@/integrations/unsplash"

import { UnsplashSearch, type UnsplashResults } from "../UnsplashSearch"

const photo = (id: string, name: string, alt: string | null = `${id} alt`): UnsplashPhoto => ({
  id,
  width: 1500,
  height: 1000,
  color: "#405060",
  alt,
  thumbUrl: `https://images.unsplash.com/${id}?w=400`,
  rawUrl: `https://images.unsplash.com/${id}`,
  pageUrl: `https://unsplash.com/photos/${id}`,
  downloadLocation: `https://api.unsplash.com/photos/${id}/download`,
  photographer: { name, username: name.toLowerCase(), profileUrl: `https://unsplash.com/@${id}` },
})

const page = (
  results: UnsplashPhoto[],
  totalPages = 1,
  rateLimit: UnsplashResults["rateLimit"] = null,
): UnsplashResults => ({
  total: results.length,
  totalPages,
  results,
  rateLimit,
  homeUrl: "https://unsplash.com/?utm_source=x",
})

function search(query: string): void {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search Unsplash" }), {
    target: { value: query },
  })
  fireEvent.click(screen.getByRole("button", { name: "Search" }))
}

describe("UnsplashSearch", () => {
  it("doesn't search for blank input", () => {
    const searchFn = vi.fn()
    render(<UnsplashSearch search={searchFn} onPick={vi.fn()} />)
    search("   ")
    expect(searchFn).not.toHaveBeenCalled()
  })

  it("searches with the chosen shape and lists photos with their credits", async () => {
    const searchFn = vi.fn(async () => page([photo("a1", "Ada"), photo("b2", "Grace", null)]))
    render(<UnsplashSearch search={searchFn} onPick={vi.fn()} />)

    fireEvent.change(screen.getByRole("combobox", { name: "Shape" }), {
      target: { value: "portrait" },
    })
    search(" dusk ")

    expect(await screen.findAllByRole("listitem")).toHaveLength(2)
    expect(searchFn).toHaveBeenCalledWith("dusk", 1, "portrait")
    expect(screen.getByRole("link", { name: "Ada" })).toHaveAttribute(
      "href",
      "https://unsplash.com/@a1",
    )
    // A photo without alt text is still named for screen readers.
    expect(screen.getByRole("button", { name: "Use this photo by Grace" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Unsplash" })).toHaveAttribute(
      "href",
      "https://unsplash.com/?utm_source=x",
    )
    expect(screen.queryByRole("button", { name: "More photos" })).not.toBeInTheDocument()
  })

  it("shows the requests left as of the latest search, when Unsplash says", async () => {
    const searchFn = vi
      .fn<() => Promise<UnsplashResults>>()
      .mockResolvedValueOnce(page([photo("a1", "Ada")], 2, { limit: 50, remaining: 41 }))
      .mockResolvedValueOnce(page([photo("b2", "Grace")], 2, { limit: 50, remaining: 40 }))
    render(<UnsplashSearch search={searchFn} onPick={vi.fn()} />)

    search("dusk")
    expect(await screen.findByText(/41 of 50 Unsplash requests left this hour/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "More photos" }))
    expect(await screen.findByText(/40 of 50 Unsplash requests left this hour/)).toBeInTheDocument()
  })

  it("leaves the count out when Unsplash doesn't send one", async () => {
    render(
      <UnsplashSearch search={vi.fn(async () => page([photo("a1", "Ada")]))} onPick={vi.fn()} />,
    )
    search("dusk")
    await screen.findAllByRole("listitem")
    expect(screen.queryByText(/requests left this hour/)).not.toBeInTheDocument()
  })

  it("says so while searching, and when nothing matches", async () => {
    let finish: (r: UnsplashResults) => void = () => undefined
    const searchFn = vi.fn(() => new Promise<UnsplashResults>((r) => (finish = r)))
    render(<UnsplashSearch search={searchFn} onPick={vi.fn()} />)

    search("zzzz")
    expect(screen.getByRole("button", { name: "Searching…" })).toBeDisabled()

    await act(async () => finish(page([])))
    expect(screen.getByText("No photos match “zzzz”.")).toBeInTheDocument()
  })

  it("shows why a search failed", async () => {
    render(
      <UnsplashSearch
        search={vi.fn(async () => {
          throw new Error("Unsplash isn't set up on this site.")
        })}
        onPick={vi.fn()}
      />,
    )
    search("x")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unsplash isn't set up on this site.",
    )
  })

  it("appends the next page, and hides More once the last page is in", async () => {
    const searchFn = vi
      .fn()
      .mockResolvedValueOnce(page([photo("a1", "Ada")], 2))
      .mockResolvedValueOnce(page([photo("b2", "Grace")], 2))
    render(<UnsplashSearch search={searchFn} onPick={vi.fn()} />)

    search("x")
    fireEvent.click(await screen.findByRole("button", { name: "More photos" }))

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2))
    expect(searchFn).toHaveBeenLastCalledWith("x", 2, "")
    expect(screen.queryByRole("button", { name: "More photos" })).not.toBeInTheDocument()
  })

  it("keeps the results when loading more fails", async () => {
    const searchFn = vi
      .fn()
      .mockResolvedValueOnce(page([photo("a1", "Ada")], 3))
      .mockRejectedValueOnce(new Error("Rate limited"))
    render(<UnsplashSearch search={searchFn} onPick={vi.fn()} />)

    search("x")
    fireEvent.click(await screen.findByRole("button", { name: "More photos" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Rate limited")
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
    expect(screen.getByRole("button", { name: "More photos" })).toBeEnabled()
  })

  it("picks a photo, locking the grid while it's added", async () => {
    let done: () => void = () => undefined
    const onPick = vi.fn(() => new Promise<void>((r) => (done = r)))
    const a1 = photo("a1", "Ada")
    render(
      <UnsplashSearch
        search={vi.fn(async () => page([a1, photo("b2", "Grace")]))}
        onPick={onPick}
      />,
    )

    search("x")
    fireEvent.click(await screen.findByRole("button", { name: "Use a1 alt by Ada" }))

    expect(onPick).toHaveBeenCalledWith(a1, "https://unsplash.com/?utm_source=x")
    expect(screen.getByText("Adding…")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Use b2 alt by Grace" })).toBeDisabled()

    await act(async () => done())
    expect(screen.queryByText("Adding…")).not.toBeInTheDocument()
  })

  it("shows why a pick failed and lets the editor try again", async () => {
    const onPick = vi.fn(async () => {
      throw new Error("Unsplash download failed.")
    })
    render(
      <UnsplashSearch search={vi.fn(async () => page([photo("a1", "Ada")]))} onPick={onPick} />,
    )

    search("x")
    fireEvent.click(await screen.findByRole("button", { name: "Use a1 alt by Ada" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Unsplash download failed.")
    expect(screen.getByRole("button", { name: "Use a1 alt by Ada" })).toBeEnabled()
  })

  it("doesn't let its submit reach the document's form around it", async () => {
    const outer = vi.fn()
    render(
      <form onSubmit={outer}>
        <UnsplashSearch search={vi.fn(async () => page([]))} onPick={vi.fn()} />
      </form>,
    )
    search("x")
    await screen.findByText("No photos match “x”.")
    expect(outer).not.toHaveBeenCalled()
  })
})
