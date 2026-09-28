import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DrilldownSearch } from "../DrilldownSearch"
import { DRILLDOWN_SEARCH_SCHEMA, type SearchEntry } from "../search"
import type { RegionIndex } from "../types"

const entries: SearchEntry[] = [
  { id: "a", name: "Anne Adams", region: "ca8" },
  { id: "b", name: "Ann Baker", region: "ca9", image: "https://example.test/b.jpg" },
  { id: "c", name: "Annette Cole", region: "dc" },
]

const regions = {
  byId: { ca8: { label: "Eighth Circuit" }, ca9: { label: "Ninth Circuit" } },
  topLevel: [],
  childrenOf: {},
} as unknown as RegionIndex

const fetchMock = vi.fn()
const onSelect = vi.fn()

const box = (): HTMLInputElement => screen.getByRole("combobox")
const options = (): HTMLElement[] => screen.queryAllByRole("option")
const selected = (): HTMLElement | undefined =>
  options().find((o) => o.getAttribute("aria-selected") === "true")

async function typeQuery(value: string): Promise<void> {
  fireEvent.change(box(), { target: { value } })
  await waitFor(() => expect(options().length).toBeGreaterThan(0))
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockResolvedValue(Response.json({ schema: DRILLDOWN_SEARCH_SCHEMA, entries }))
  vi.stubGlobal("fetch", fetchMock)
  render(
    <DrilldownSearch url="/search" regions={regions} label="Search judges" onSelect={onSelect} />,
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("DrilldownSearch", () => {
  it("names itself in the interactive's vocabulary", () => {
    expect(box()).toHaveAccessibleName("Search judges")
    expect(box()).toHaveAttribute("placeholder", "Search judges")
    expect(box()).toHaveAttribute("aria-expanded", "false")
  })

  it("fetches the index once, however many times the reader focuses and types", async () => {
    fireEvent.focus(box())
    fireEvent.focus(box())
    await typeQuery("ann")
    fireEvent.change(box(), { target: { value: "anne" } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/search", expect.anything())
  })

  it("lists matches with their region's label, falling back to the region id", async () => {
    await typeQuery("ann")
    expect(box()).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("listbox")).toHaveAccessibleName("Search judges")
    expect(options().map((o) => o.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Eighth Circuit"),
        expect.stringContaining("Ninth Circuit"),
        expect.stringContaining("dc"),
      ]),
    )
  })

  it("walks the list with the arrow keys, wrapping at both ends, and Home/End", async () => {
    await typeQuery("ann")
    const count = options().length
    expect(options().indexOf(selected()!)).toBe(0)
    expect(box()).toHaveAttribute("aria-activedescendant", selected()!.id)

    fireEvent.keyDown(box(), { key: "ArrowUp" })
    expect(options().indexOf(selected()!)).toBe(count - 1)
    fireEvent.keyDown(box(), { key: "ArrowDown" })
    expect(options().indexOf(selected()!)).toBe(0)
    fireEvent.keyDown(box(), { key: "End" })
    expect(options().indexOf(selected()!)).toBe(count - 1)
    fireEvent.keyDown(box(), { key: "Home" })
    expect(options().indexOf(selected()!)).toBe(0)
    fireEvent.mouseEnter(options()[1]!)
    expect(options().indexOf(selected()!)).toBe(1)
  })

  it("commits the active result on Enter, then clears itself", async () => {
    await typeQuery("ann")
    fireEvent.keyDown(box(), { key: "ArrowDown" })
    const id = selected()!.getAttribute("data-drilldown-search-result")
    fireEvent.keyDown(box(), { key: "Enter" })
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id }))
    expect(box()).toHaveValue("")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("commits a clicked result", async () => {
    await typeQuery("baker")
    fireEvent.click(options()[0]!)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }))
  })

  it("closes the list on the first Escape and clears the box on the second", async () => {
    await typeQuery("ann")
    fireEvent.keyDown(box(), { key: "Escape" })
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    expect(box()).toHaveValue("ann")
    fireEvent.keyDown(box(), { key: "Escape" })
    expect(box()).toHaveValue("")
  })

  it("reopens the list with the arrow keys after it was dismissed", async () => {
    await typeQuery("ann")
    fireEvent.keyDown(box(), { key: "Escape" })
    fireEvent.keyDown(box(), { key: "ArrowDown" })
    expect(screen.getByRole("listbox")).toBeInTheDocument()
  })

  it("clears the query with its own button", async () => {
    await typeQuery("ann")
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
    expect(box()).toHaveValue("")
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument()
  })

  it("closes the list when the box loses focus", async () => {
    await typeQuery("ann")
    fireEvent.blur(box())
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("says so when nothing matches", async () => {
    fireEvent.change(box(), { target: { value: "zzz" } })
    expect(await screen.findByText("No matches.")).toBeInTheDocument()
  })

  it("says search is unavailable when the index fails to load, and logs why", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }))
    fireEvent.change(box(), { target: { value: "ann" } })
    expect(await screen.findByText("Search is unavailable.")).toBeInTheDocument()
    expect(error).toHaveBeenCalledWith(
      "[interactive-map] failed to load the search index:",
      expect.objectContaining({ message: "HTTP 500" }),
    )
    error.mockRestore()
  })

  it("rejects a response that isn't a search index", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    fetchMock.mockResolvedValue(Response.json({ entries }))
    fireEvent.change(box(), { target: { value: "ann" } })
    expect(await screen.findByText("Search is unavailable.")).toBeInTheDocument()
    error.mockRestore()
  })

  it("shows it is loading while the index is on its way", async () => {
    let resolve!: (r: Response) => void
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)))
    fireEvent.change(box(), { target: { value: "ann" } })
    expect(await screen.findByText("Loading…")).toBeInTheDocument()
    await act(async () => resolve(Response.json({ schema: DRILLDOWN_SEARCH_SCHEMA, entries })))
    await waitFor(() => expect(options().length).toBeGreaterThan(0))
  })
})
