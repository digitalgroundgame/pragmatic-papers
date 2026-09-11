import { expect, test } from "@playwright/test"

import { waitForStableRender } from "./helpers"

const PAGE = "/interactives/federal-courts"

test.describe("interactive page — federal courts", () => {
  test("overview renders from the published snapshot, with prefetchable JSON regions @visual", async ({
    page,
  }, testInfo) => {
    await page.goto(PAGE)

    const figure = page.locator("[data-interactive-drilldown]")
    await expect(figure).toBeVisible()
    await expect(page.locator("h1")).toHaveText("Federal Court Appointment Tracker")
    // The header says when the judiciary last changed, not only when the sync ran.
    await expect(page.locator("[data-interactive-meta]")).toContainText("last appointment")

    // The overview geometry is in the HTML; regions are only referenced, as same-origin JSON.
    await expect(page.locator("svg[data-drilldown-overview] path[data-role='parent']")).toHaveCount(
      12,
    )
    // Two per region: its records, and its shapes from a hashed URL of their own.
    await expect(page.locator(`head link[rel='prefetch'][href^='${PAGE}/regions/']`)).toHaveCount(
      26,
    )
    await expect(page.locator("[data-drilldown-layer='local']")).toHaveCount(0)

    // Seat blocks are drawn once the client adopts the SVG, from facts the snapshot carries.
    await expect(page.locator("svg[data-drilldown-overview] g[data-drilldown-block]")).toHaveCount(
      14,
    )

    // Hover shows the region's facts, which come from the feed through the profile's labels.
    const ca8 = page.locator(
      "svg[data-drilldown-overview] path[data-region-id='ca8'][data-role='parent']",
    )
    await ca8.hover()
    await expect(page.locator("[data-drilldown-tooltip]")).toContainText("Eighth Circuit")

    await ca8.click()
    const pane = page.locator("[data-drilldown-pane][data-open]")
    await expect(pane).toBeVisible()
    await expect(pane.locator("[data-drilldown-pane-title]")).toHaveText(
      "U.S. Court of Appeals for the Eighth Circuit",
    )
    await expect(pane.locator("[data-drilldown-node]").first()).toBeVisible()
    await expect(pane.locator("[data-drilldown-associate-node]")).toContainText("Circ. Justice")

    // A judge's card carries the face of the president who appointed them.
    await pane.locator("[data-drilldown-node]").first().click()
    const detail = pane.locator("[data-drilldown-detail]")
    await expect(detail).toHaveAttribute("data-pinned", "")
    await expect(detail.locator("[data-drilldown-portrait]")).toHaveAttribute(
      "src",
      /^https:\/\/upload\.wikimedia\.org\//,
    )
    // The counts live in the summary line; the facts row carries what the summary lacks.
    await expect(pane).toContainText("11 authorized · 11 active · 6 senior")

    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")

    // Photos are hotlinked from Wikimedia; do not let a slow remote decide the screenshot.
    await page.route("https://upload.wikimedia.org/**", (route) => route.abort())
    // The drilled-in region now survives a reload — nothing left to re-select. The pane comes
    // back open on Eighth Circuit, just without the pin the click above left on one judge.
    await page.reload()
    await figure.scrollIntoViewIfNeeded()
    await expect(
      page.locator("[data-drilldown-pane][data-open] [data-drilldown-node]").first(),
    ).toBeVisible()
    await page.mouse.move(0, 0)
    await waitForStableRender(page)

    const PADDING = 16
    const box = await figure.boundingBox()
    if (!box) throw new Error("map figure bounding box not available")
    await expect(page).toHaveScreenshot("interactive-page-drilldown-pane.png", {
      clip: {
        x: box.x - PADDING,
        y: box.y - PADDING,
        width: box.width + PADDING * 2,
        height: box.height + PADDING * 2,
      },
    })
  })

  test("drilling into a region morphs to its child map and back", async ({ page }) => {
    await page.goto(PAGE)
    const figure = page.locator("[data-interactive-drilldown]")
    await figure.scrollIntoViewIfNeeded()

    // A region with a map of its own opens it in the same click that chooses it — no separate
    // "View districts" step, wherever the choice is made from.
    await page.locator("[data-drilldown-selector] [data-region-item='ca8']").click()
    const pane = page.locator("[data-drilldown-pane][data-open]")
    await expect(pane).toBeVisible()

    const viewport = page.locator("[data-drilldown-viewport]")
    await expect(viewport).toHaveAttribute("data-view", "child")
    await expect(viewport).not.toHaveAttribute("aria-busy", "true")
    const local = page.locator("[data-drilldown-layer='local'][data-parent-id='ca8']")
    await expect(local).toHaveAttribute("data-state", "visible")
    await expect(local.locator("g[data-drilldown-block]")).toHaveCount(11)
    await expect(page.locator("[data-drilldown-layer='morph']")).toHaveCount(0)
    // The rail still lists only top-level circuits — a district is reached from the map that
    // just drilled to show them, not from a rail row that was never asked to expand.
    // A district always carries a parentId, so its role is "child" here too, wherever it's
    // the map's own current top layer.
    const moed = local.locator("path[data-region-id='moed'][data-role='child']")
    await expect(moed).toBeVisible()

    // A district's records come from the parent's asset, already loaded.
    await moed.click()
    await expect(
      page.locator("[data-drilldown-pane][data-open] [data-drilldown-pane-title]"),
    ).toHaveText("U.S. District Court for the Eastern District of Missouri")

    await page.getByRole("button", { name: "Back to overview" }).click()
    await expect(viewport).toHaveAttribute("data-view", "overview")
    await expect(viewport).not.toHaveAttribute("aria-busy", "true")
    await expect(page.locator("[data-drilldown-layer='overview']")).toHaveAttribute(
      "data-state",
      "visible",
    )
    await expect(page.locator("[data-drilldown-selector] [data-region-item='ca1']")).toBeVisible()
  })

  test("the overview pane starts empty, not landed on the Supreme Court", async ({ page }) => {
    await page.goto(PAGE)
    // The landing view (the whole bench, parked behind `summary`) is built and tested at the
    // component level (Summary.tsx), but the page itself keeps the pane empty until the reader
    // picks something — every other unselected state works the same way, and opening straight
    // onto a filled-in Supreme Court bench read as the page choosing for the reader.
    const pane = page.locator("[data-drilldown-pane]")
    await expect(pane).not.toHaveAttribute("data-open", "")
    await expect(pane.locator("[data-drilldown-empty]")).toHaveText(
      "Select a court on the map or from the list to see who sits on its bench.",
    )
    await expect(pane.locator("[data-summary-scotus]")).toHaveCount(0)
  })

  test("searching a judge by name opens their court and pins them", async ({ page }) => {
    await page.goto(PAGE)
    const box = page.getByRole("combobox", { name: "Search judges" })
    await expect(box).toBeVisible()

    // The index is a route of its own, fetched only once the reader searches.
    await box.fill("kayatta")
    const option = page.getByRole("option", { name: /Kayatta/ })
    // The region beside the name is what tells two judges of the same name apart.
    await expect(option).toContainText("First Circuit")
    await option.click()

    const pane = page.locator("[data-drilldown-pane][data-open]")
    await expect(pane.locator("[data-drilldown-pane-title]")).toHaveText(
      "U.S. Court of Appeals for the First Circuit",
    )
    const detail = pane.locator("[data-drilldown-detail]")
    await expect(detail).toHaveAttribute("data-pinned", "")
    await expect(detail).toContainText("Kayatta")
    // Landing on a pinned record folds the rail to give the detail room; the search box is
    // behind the glyph that unfolds it again, not gone.
    await expect(page.locator("[data-drilldown-search-open]")).toBeVisible()
  })

  test("a search for a district judge drills into the circuit first", async ({ page }) => {
    await page.goto(PAGE)
    await page.getByRole("combobox", { name: "Search judges" }).fill("woodlock")
    await page.getByRole("option", { name: /Woodlock/ }).click()

    const viewport = page.locator("[data-drilldown-viewport]")
    await expect(viewport).toHaveAttribute("data-view", "child")
    await expect(viewport).not.toHaveAttribute("aria-busy", "true")

    const pane = page.locator("[data-drilldown-pane][data-open]")
    // The pane's own heading carries the court's full official name (the citation abbreviation
    // upstream publishes, "D. Mass.", is a lawyer's shorthand nobody else uses) — everywhere
    // else the region is named, the rail, the trail, a tooltip, drops the boilerplate opening.
    await expect(pane.locator("[data-drilldown-pane-title]")).toHaveText(
      "U.S. District Court for the District of Massachusetts",
    )
    await expect(pane.locator("[data-drilldown-detail]")).toHaveAttribute("data-pinned", "")
  })

  test("the search index is served as JSON and names every record once", async ({ page }) => {
    const res = await page.request.get(`${PAGE}/search`)
    expect(res.ok()).toBe(true)
    expect(res.headers()["content-type"]).toContain("application/json")
    const index = (await res.json()) as { entries: { id: string; name: string; region: string }[] }
    expect(index.entries.length).toBeGreaterThan(1000)
    expect(new Set(index.entries.map((e) => e.id)).size).toBe(index.entries.length)
    expect(index.entries.every((e) => typeof e.name === "string" && e.name.length > 0)).toBe(true)
  })

  test("a region is composed server-side and served as two halves", async ({ page }) => {
    await page.goto(PAGE)
    const region = await page.request.get(`${PAGE}/regions/ca8`)
    expect(region.ok()).toBe(true)
    expect(region.headers()["content-type"]).toContain("application/json")
    const data = (await region.json()) as {
      paths: unknown[]
      payload: { records: { items: unknown[] }; facts?: unknown; seats?: unknown }
    }
    expect(data.payload.records.items.length).toBeGreaterThan(50)
    // Presentation-wide settings live on the overview, never repeated per region.
    expect(data.payload.facts).toBeUndefined()
    expect(data.payload.seats).toBeUndefined()
    // The half that changes with every sync carries no shapes to change with it.
    expect(data.paths).toEqual([])
    expect(region.headers()["cache-control"]).not.toContain("immutable")

    const href = await page
      .locator(`head link[rel='prefetch'][href*='/regions/ca8/geometry/']`)
      .getAttribute("href")
    const geometry = await page.request.get(href!)
    expect(geometry.ok()).toBe(true)
    const shapes = (await geometry.json()) as { paths: { id: string | null }[]; payload: null }
    expect(shapes.paths.filter((p) => p.id).length).toBe(11)
    expect(shapes.payload).toBeNull()
    // Its URL names its own content, so it can be held for as long as the browser likes.
    expect(geometry.headers()["cache-control"]).toContain("immutable")
  })

  test("a region that is not drillable is a 404", async ({ page }) => {
    const res = await page.request.get(`${PAGE}/regions/moed`)
    expect(res.status()).toBe(404)
  })

  test("a geometry URL naming the wrong hash is a 404, not a year-long cache of the current map", async ({
    page,
  }) => {
    await page.goto(PAGE)
    const href = await page
      .locator(`head link[rel='prefetch'][href*='/regions/ca8/geometry/']`)
      .getAttribute("href")
    const stale = href!.replace(/\/geometry\/[^/]+$/, "/geometry/not-the-real-hash")
    const res = await page.request.get(stale)
    expect(res.status()).toBe(404)
    expect(res.headers()["cache-control"]).not.toContain("immutable")
  })

  test("the region list is one tab stop, and a keyboard selection lands in the pane", async ({
    page,
  }) => {
    await page.goto(PAGE)
    const items = page.locator("[data-drilldown-selector] button[data-region-item]")
    await items.first().waitFor()

    // 14 regions, one tab stop: the arrow keys move within the list.
    await expect(items).toHaveCount(14)
    await expect(items.filter({ has: page.locator(":scope[tabindex='0']") })).toHaveCount(1)

    // ArrowLeft/Right are a tree's expand/collapse, not the roving tabindex — Down/Up move it,
    // one region at a time, the same as before.
    await items.first().focus()
    for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowDown")
    await expect(page.locator("[data-drilldown-selector] button:focus")).toHaveAttribute(
      "data-region-item",
      "ca8",
    )

    // Enter selects and hands focus to the pane's heading, so the bench is where the reader is.
    await page.keyboard.press("Enter")
    const title = page.locator("[data-drilldown-pane][data-open] [data-drilldown-pane-title]")
    await expect(title).toHaveText("U.S. Court of Appeals for the Eighth Circuit")
    await expect(title).toBeFocused()

    // Escape closes it and puts focus back on the region it came from.
    await page.keyboard.press("Escape")
    await expect(page.locator("[data-drilldown-pane][data-open]")).toHaveCount(0)
    await expect(page.locator("[data-drilldown-selector] button:focus")).toHaveAttribute(
      "data-region-item",
      "ca8",
    )
  })
})
