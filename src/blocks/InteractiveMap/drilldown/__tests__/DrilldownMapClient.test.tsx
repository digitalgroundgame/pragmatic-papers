import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DrilldownMapClient } from "@/blocks/InteractiveMap/drilldown/DrilldownMapClient"
import { DrilldownOverviewSvg } from "@/blocks/InteractiveMap/drilldown/DrilldownOverviewSvg"
import { parseDrilldownAssetString } from "@/blocks/InteractiveMap/drilldown/parseAsset"
import { buildRegionIndex } from "@/blocks/InteractiveMap/drilldown/regions"
import { DRILLDOWN_SEARCH_SCHEMA } from "@/blocks/InteractiveMap/drilldown/search"
import { DRILLDOWN_SCHEMA, type DrilldownAsset } from "@/blocks/InteractiveMap/drilldown/types"

const display = {
  title: "name",
  shortTitle: "short",
  category: {
    field: "party",
    values: [
      { value: "R", label: "Republican", shortLabel: "R-appointed", color: "red" },
      { value: "D", label: "Democratic", shortLabel: "D-appointed", color: "blue" },
    ],
  },
  order: "since",
  status: { field: "status", supernumerary: ["senior"], labels: { senior: "Senior" } },
  seatsFact: "seats",
  cohort: "appointer",
  flags: [{ field: "chief", label: "Chief", symbol: "★" }],
  marks: [{ field: "fedsoc", label: "FedSoc" }],
  details: [
    { field: "appointer", label: "Appointed by" },
    { field: "since", format: "years-since", label: "On the bench" },
    { field: "url", format: "link", label: "Profile" },
  ],
}

const overviewPayload = {
  schema: DRILLDOWN_SCHEMA,
  seats: {
    totalFact: "seats",
    groups: [
      { fact: "seats-r", label: "R", color: "red" },
      { fact: "seats-d", label: "D", color: "blue" },
    ],
    labelFact: "short-label",
  },
  records: {
    items: [
      {
        _region: "west",
        _role: "associate",
        name: "Justice West",
        short: "Justice",
        party: "D",
        since: "2000-01-01",
      },
    ],
    display,
  },
}

const overviewSvg = `<svg viewBox="0 0 100 50">
  <g transform="scale(1,-1) translate(0,-50)">
    <path id="west" data-region-label="West" data-seats="3" data-seats-r="1" data-seats-d="1" data-short-label="W" data-summary="3 authorized" data-children-label="districts" d="M0 0 L50 0 L50 50 L0 50"/>
    <path id="east" data-region-label="East" data-seats="2" d="M50 0 L100 0 L100 50 L50 50"/>
    <path id="w1" data-parent-id="west" data-region-label="West 1" d="M0 0 L25 0 L25 50 L0 50"/>
    <path id="w2" data-parent-id="west" data-region-label="West 2" d="M25 0 L50 0 L50 50 L25 50"/>
  </g>
</svg>`

const westPayload = {
  schema: DRILLDOWN_SCHEMA,
  records: {
    items: [
      {
        _region: "west",
        _id: "a",
        name: "Ada Lovelace",
        short: "Lovelace",
        party: "D",
        status: "active",
        since: "2010-05-05",
        appointer: "P1",
        chief: true,
        url: "https://example.com/a",
      },
      {
        _region: "west",
        _id: "b",
        name: "Alan Turing",
        short: "Turing",
        party: "R",
        status: "active",
        since: "2012-05-05",
        appointer: "P2",
        fedsoc: true,
      },
      {
        _region: "west",
        _id: "c",
        name: "Grace Hopper",
        short: "Hopper",
        party: "D",
        status: "senior",
        since: "1990-05-05",
        appointer: "P1",
      },
      {
        _region: "w1",
        _id: "d",
        name: "Katherine Johnson",
        short: "Johnson",
        party: "D",
        status: "active",
        since: "2015-01-01",
        appointer: "P1",
      },
    ],
    display,
  },
}

const westSvg = `<svg viewBox="0 0 50 50">
  <g transform="scale(1,-1) translate(0,-50)">
    <path id="west" data-region-label="West" d="M0 0 L50 0 L50 50 L0 50"/>
    <path id="w1" data-parent-id="west" data-region-label="West 1" data-seats="2" d="M0 0 L25 0 L25 50 L0 50"/>
    <path id="w2" data-parent-id="west" data-region-label="West 2" data-seats="1" d="M25 0 L50 0 L50 50 L25 50"/>
  </g>
</svg>`

const searchIndex = {
  schema: DRILLDOWN_SEARCH_SCHEMA,
  entries: [
    { id: "a", name: "Ada Lovelace", region: "west" },
    { id: "c", name: "Grace Hopper", region: "west" },
    { id: "d", name: "Katherine Johnson", region: "w1" },
  ],
}

/** An asset as the server composes it: geometry from an SVG, payload from the feed. */
function compose(svg: string, payload: unknown): DrilldownAsset {
  return { ...parseDrilldownAssetString(svg), payload: payload as DrilldownAsset["payload"] }
}

function setup({ search }: { search?: { url: string; label?: string } } = {}) {
  const overview = compose(overviewSvg, overviewPayload)
  const regions = buildRegionIndex([overview])
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/regions/west") return Response.json(compose(westSvg, westPayload))
    if (url === "/search") return Response.json(searchIndex)
    return new Response("nope", { status: 404 })
  })
  vi.stubGlobal("fetch", fetchMock)
  const utils = render(
    <DrilldownMapClient
      overview={{ ...overview, paths: overview.paths.map((p) => ({ ...p, d: "" })) }}
      search={search}
      childAssets={[
        { regionId: "west", url: "/regions/west" },
        { regionId: "east", url: "/regions/east" },
      ]}
    >
      <div data-drilldown-layer="overview" data-state="visible">
        <DrilldownOverviewSvg asset={overview} regions={regions} />
      </div>
    </DrilldownMapClient>,
  )
  return { ...utils, fetchMock }
}

const pane = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("[data-drilldown-pane]")!
const selector = (container: HTMLElement) =>
  within(container.querySelector<HTMLElement>("[data-drilldown-selector]")!)

describe("DrilldownMapClient", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("adopts the server-rendered overview: hover overlay and seat blocks are added, nothing else changes", () => {
    const { container } = setup()
    const svg = container.querySelector("svg[data-drilldown-overview]")!
    expect(svg.querySelector("path[data-drilldown-overlay]")).toBeInTheDocument()
    const blocks = svg.querySelectorAll("g[data-drilldown-block]")
    expect(Array.from(blocks).map((b) => b.getAttribute("data-region-id"))).toEqual([
      "east",
      "west",
    ])
    // west: 1 R + 1 D + 1 vacant of 3 seats
    const west = svg.querySelector('g[data-drilldown-block][data-region-id="west"]')!
    expect(west.querySelectorAll('rect[data-block-seat="filled"]')).toHaveLength(2)
    expect(west.querySelectorAll('rect[data-block-seat="vacant"]')).toHaveLength(1)
    expect(west.querySelector("text[data-block-label]")).toHaveTextContent("W")
    // interactive shapes advertise as buttons only once the stage is behind them
    expect(svg.querySelector('path[data-region-id="west"][data-role="parent"]')).toHaveAttribute(
      "role",
      "button",
    )
    expect(svg.querySelector('path[data-region-id="w1"]')).not.toHaveAttribute("role")
    // no child asset was requested for the overview
    expect(fetch).not.toHaveBeenCalled()
  })

  it("selecting a region from the selector opens the pane, fetches its asset once and shows the bench", async () => {
    const { container, fetchMock } = setup()
    const item = selector(container).getByRole("button", { name: "West" })
    fireEvent.click(item)
    fireEvent.click(item) // toggles the pane closed
    fireEvent.click(item) // and open again — still one fetch
    await waitFor(() => expect(pane(container)).toHaveAttribute("data-open"))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/regions/west", expect.anything())

    const p = pane(container)
    await waitFor(() =>
      expect(within(p).getAllByRole("button", { name: "Ada Lovelace" })).not.toHaveLength(0),
    )
    expect(within(p).getByText("3 authorized")).toBeInTheDocument()
    // 3 bench members (2 active + 1 senior in the timeline), 1 vacancy, the associate chip
    expect(p.querySelectorAll("[data-drilldown-node]")).toHaveLength(3)
    expect(p.querySelectorAll("[data-drilldown-vacancy]")).toHaveLength(1)
    expect(p.querySelector("[data-drilldown-associate-node]")).toHaveTextContent("Justice")
    // the drill control uses the region's children label
    expect(within(p).getByRole("button", { name: "View districts →" })).toBeInTheDocument()
    // the map shape is highlighted too
    expect(
      container.querySelector('path[data-region-id="west"][data-role="parent"]'),
    ).toHaveAttribute("data-selected")
  })

  it("hovering a bench member fills the docked detail panel; clicking pins it", async () => {
    const { container } = setup()
    fireEvent.click(selector(container).getByRole("button", { name: "West" }))
    const p = pane(container)
    const ada = await within(p).findByRole("button", { name: "Ada Lovelace" })
    fireEvent.pointerEnter(ada)
    const detail = p.querySelector<HTMLElement>("[data-drilldown-detail]")!
    expect(within(detail).getByText("Ada Lovelace")).toBeInTheDocument()
    expect(within(detail).getByText("★ Chief")).toBeInTheDocument()
    expect(within(detail).getByText("Appointed by:")).toBeInTheDocument()
    expect(within(detail).getByRole("link", { name: /Profile/ })).toHaveAttribute(
      "href",
      "https://example.com/a",
    )
    expect(detail).not.toHaveAttribute("data-pinned")
    fireEvent.click(ada)
    expect(detail).toHaveAttribute("data-pinned")
    // pinned: hovering someone else does not replace it
    fireEvent.pointerEnter(within(p).getByRole("button", { name: "Alan Turing" }))
    expect(within(detail).getByText("Ada Lovelace")).toBeInTheDocument()
  })

  it("seat-chart view folds supernumerary members and reports the majority", async () => {
    const { container } = setup()
    fireEvent.click(selector(container).getByRole("button", { name: "West" }))
    const p = pane(container)
    await within(p).findByRole("button", { name: "Ada Lovelace" })
    fireEvent.click(within(p).getByRole("button", { name: "Seats" }))
    const count = () => p.querySelector("[data-drilldown-count]")!.textContent
    expect(count()).toBe("D-appointed 1 of 2 · majority 2 (no majority)")
    // the senior row appears only in seats mode
    fireEvent.click(within(p).getByRole("button", { name: "Include" }))
    expect(count()).toBe("D-appointed 2 of 3 · majority 2 ✓ · incl. senior")
  })

  it("drilling in switches the selector to the children and renders their blocks on the child layer", async () => {
    const { container } = setup()
    fireEvent.click(selector(container).getByRole("button", { name: "West" }))
    const p = pane(container)
    const drill = await within(p).findByRole("button", { name: "View districts →" })
    fireEvent.click(drill)
    await waitFor(() =>
      expect(container.querySelector("[data-drilldown-viewport]")).toHaveAttribute(
        "data-view",
        "child",
      ),
    )
    const nav = container.querySelector<HTMLElement>("[data-drilldown-selector]")!
    expect(within(nav).getByRole("button", { name: "← Back to overview" })).toBeInTheDocument()
    expect(within(nav).getByRole("button", { name: "West 1" })).toBeInTheDocument()
    expect(within(nav).queryByRole("button", { name: "East" })).not.toBeInTheDocument()
    await waitFor(() => expect(pane(container)).not.toHaveAttribute("data-open"))

    const local = container.querySelector<HTMLElement>('[data-drilldown-layer="local"]')!
    expect(local).toHaveAttribute("data-parent-id", "west")
    await waitFor(() =>
      expect(
        Array.from(local.querySelectorAll("g[data-drilldown-block]")).map((b) =>
          b.getAttribute("data-region-id"),
        ),
      ).toEqual(["w1", "w2"]),
    )
    // child paths are the interactive ones in the child view
    expect(local.querySelector('path[data-region-id="w1"]')).toHaveAttribute("role", "button")
    expect(local.querySelector('path[data-region-id="west"]')).toHaveAttribute(
      "data-role",
      "parent",
    )

    // selecting a child shows its records from the parent's asset
    fireEvent.click(within(nav).getByRole("button", { name: "West 1" }))
    await waitFor(() => expect(pane(container)).toHaveAttribute("data-open"))
    expect(
      within(pane(container)).getByRole("button", { name: "Katherine Johnson" }),
    ).toBeInTheDocument()

    fireEvent.click(within(nav).getByRole("button", { name: "← Back to overview" }))
    await waitFor(() =>
      expect(container.querySelector("[data-drilldown-viewport]")).toHaveAttribute(
        "data-view",
        "overview",
      ),
    )
    expect(
      within(container.querySelector<HTMLElement>("[data-drilldown-selector]")!).getByRole(
        "button",
        { name: "East" },
      ),
    ).toBeInTheDocument()
  })

  it("shows an error state when the region asset cannot be fetched", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const { container } = setup()
    fireEvent.click(selector(container).getByRole("button", { name: "East" }))
    const p = pane(container)
    await waitFor(() => expect(p.querySelector("[data-drilldown-error]")).toBeInTheDocument())
  })

  it("Escape closes the pane and clears the selection", async () => {
    const { container } = setup()
    fireEvent.click(selector(container).getByRole("button", { name: "West" }))
    await waitFor(() => expect(pane(container)).toHaveAttribute("data-open"))
    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(pane(container)).not.toHaveAttribute("data-open"))
    expect(container.querySelector("path[data-selected]")).not.toBeInTheDocument()
  })

  it("search is off unless the caller supplies an index", () => {
    const { container } = setup()
    expect(container.querySelector("[data-drilldown-search]")).not.toBeInTheDocument()
  })

  it("a search result selects the record's region and pins the record", async () => {
    const { container, getByRole, fetchMock } = setup({
      search: { url: "/search", label: "Search judges" },
    })
    // The index is not fetched until the reader actually searches.
    expect(fetchMock).not.toHaveBeenCalled()

    const box = getByRole("combobox", { name: "Search judges" })
    fireEvent.change(box, { target: { value: "hopper" } })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/search", expect.anything()))

    const option = await within(container).findByRole("option", { name: /Grace Hopper/ })
    expect(option).toHaveTextContent("West")
    fireEvent.click(option)

    const p = pane(container)
    await waitFor(() => expect(p).toHaveAttribute("data-open"))
    expect(p.querySelector("[data-drilldown-pane-title]")).toHaveTextContent("West")
    const detail = await waitFor(() => {
      const el = p.querySelector<HTMLElement>("[data-drilldown-detail]")!
      expect(el).toHaveAttribute("data-pinned")
      return el
    })
    expect(within(detail).getByText("Grace Hopper")).toBeInTheDocument()
    // The query is cleared, so the list does not sit over the map the reader was sent to.
    expect(box).toHaveValue("")
  })

  it("a result inside a child region drills into its parent first", async () => {
    const { container, getByRole } = setup({ search: { url: "/search" } })
    fireEvent.change(getByRole("combobox"), { target: { value: "katherine" } })
    fireEvent.click(await within(container).findByRole("option", { name: /Katherine Johnson/ }))

    await waitFor(() =>
      expect(container.querySelector("[data-drilldown-viewport]")).toHaveAttribute(
        "data-view",
        "child",
      ),
    )
    const p = pane(container)
    await waitFor(() =>
      expect(p.querySelector("[data-drilldown-pane-title]")).toHaveTextContent("West 1"),
    )
    await waitFor(() =>
      expect(p.querySelector("[data-drilldown-detail]")).toHaveAttribute("data-pinned"),
    )
  })

  it("the arrow keys walk the results and Enter takes the highlighted one", async () => {
    const { container, getByRole } = setup({ search: { url: "/search" } })
    const box = getByRole("combobox")
    fireEvent.change(box, { target: { value: "a" } })
    await within(container).findByRole("option", { name: /Ada Lovelace/ })

    const names = () =>
      within(container)
        .getAllByRole("option")
        .map((o) => o.textContent)
    expect(names()[0]).toContain("Ada Lovelace")
    fireEvent.keyDown(box, { key: "ArrowDown" })
    expect(within(container).getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true")
    fireEvent.keyDown(box, { key: "Enter" })

    await waitFor(() => expect(pane(container)).toHaveAttribute("data-open"))
  })

  it("Escape in the search box dismisses the list without closing the pane", async () => {
    const { container, getByRole } = setup({ search: { url: "/search" } })
    fireEvent.click(selector(container).getByRole("button", { name: "West" }))
    await waitFor(() => expect(pane(container)).toHaveAttribute("data-open"))

    const box = getByRole("combobox")
    fireEvent.change(box, { target: { value: "ada" } })
    await within(container).findByRole("option", { name: /Ada Lovelace/ })
    fireEvent.keyDown(box, { key: "Escape" })

    expect(within(container).queryByRole("option")).not.toBeInTheDocument()
    expect(pane(container)).toHaveAttribute("data-open")
  })

  it("reports an index that cannot be loaded rather than looking like no matches", async () => {
    const { container, getByRole } = setup({ search: { url: "/missing" } })
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    fireEvent.change(getByRole("combobox"), { target: { value: "ada" } })
    await waitFor(() =>
      expect(container.querySelector("[data-drilldown-search-error]")).toBeInTheDocument(),
    )
  })
})
