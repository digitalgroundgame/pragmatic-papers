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

    // The overview geometry is in the HTML; regions are only referenced, as same-origin JSON.
    await expect(page.locator("svg[data-drilldown-overview] path[data-role='parent']")).toHaveCount(
      12,
    )
    await expect(page.locator(`head link[rel='prefetch'][href^='${PAGE}/regions/']`)).toHaveCount(
      13,
    )
    await expect(page.locator("[data-drilldown-layer='local']")).toHaveCount(0)

    // Seat blocks are drawn once the client adopts the SVG, from facts the snapshot carries.
    await expect(page.locator("svg[data-drilldown-overview] g[data-drilldown-block]")).toHaveCount(
      13,
    )

    // Hover shows the region's facts, which come from the feed through the profile's labels.
    const ca8 = page.locator(
      "svg[data-drilldown-overview] path[data-region-id='ca8'][data-role='parent']",
    )
    await ca8.hover()
    await expect(page.locator("[data-drilldown-tooltip]")).toContainText("8th Cir.")

    await ca8.click()
    const pane = page.locator("[data-drilldown-pane][data-open]")
    await expect(pane).toBeVisible()
    await expect(pane.locator("[data-drilldown-pane-title]")).toHaveText("8th Cir.")
    await expect(pane.locator("[data-drilldown-node]").first()).toBeVisible()
    await expect(pane.locator("[data-drilldown-associate-node]")).toContainText("Circ. Justice")
    // The counts live in the summary line; the facts row carries what the summary lacks.
    await expect(pane).toContainText("11 authorized · 11 active · 6 senior · 0 vacant")

    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")

    // Photos are hotlinked from Wikimedia; do not let a slow remote decide the screenshot.
    await page.route("https://upload.wikimedia.org/**", (route) => route.abort())
    await page.reload()
    await figure.scrollIntoViewIfNeeded()
    await page
      .locator("svg[data-drilldown-overview] path[data-region-id='ca8'][data-role='parent']")
      .click()
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

    await page.locator("[data-drilldown-selector] [data-region-item='ca8']").click()
    const pane = page.locator("[data-drilldown-pane][data-open]")
    await pane.getByRole("button", { name: "View districts →" }).click()

    const viewport = page.locator("[data-drilldown-viewport]")
    await expect(viewport).toHaveAttribute("data-view", "child")
    await expect(viewport).not.toHaveAttribute("aria-busy", "true")
    const local = page.locator("[data-drilldown-layer='local'][data-parent-id='ca8']")
    await expect(local).toHaveAttribute("data-state", "visible")
    await expect(local.locator("g[data-drilldown-block]")).toHaveCount(10)
    await expect(page.locator("[data-drilldown-layer='morph']")).toHaveCount(0)
    await expect(page.locator("[data-drilldown-selector] [data-region-item='moed']")).toBeVisible()

    // A district's records come from the parent's asset, already loaded.
    await page.locator("[data-drilldown-selector] [data-region-item='moed']").click()
    await expect(
      page.locator("[data-drilldown-pane][data-open] [data-drilldown-pane-title]"),
    ).toHaveText("E.D. Mo.")

    await page.getByRole("button", { name: "← Back to overview" }).click()
    await expect(viewport).toHaveAttribute("data-view", "overview")
    await expect(viewport).not.toHaveAttribute("aria-busy", "true")
    await expect(page.locator("[data-drilldown-layer='overview']")).toHaveAttribute(
      "data-state",
      "visible",
    )
    await expect(page.locator("[data-drilldown-selector] [data-region-item='ca1']")).toBeVisible()
  })

  test("searching a judge by name opens their court and pins them", async ({ page }) => {
    await page.goto(PAGE)
    const box = page.getByRole("combobox", { name: "Search judges" })
    await expect(box).toBeVisible()

    // The index is a route of its own, fetched only once the reader searches.
    await box.fill("kayatta")
    const option = page.getByRole("option", { name: /Kayatta/ })
    // The region beside the name is what tells two judges of the same name apart.
    await expect(option).toContainText("1st Cir.")
    await option.click()

    const pane = page.locator("[data-drilldown-pane][data-open]")
    await expect(pane.locator("[data-drilldown-pane-title]")).toHaveText("1st Cir.")
    const detail = pane.locator("[data-drilldown-detail]")
    await expect(detail).toHaveAttribute("data-pinned", "")
    await expect(detail).toContainText("Kayatta")
    await expect(box).toHaveValue("")
  })

  test("a search for a district judge drills into the circuit first", async ({ page }) => {
    await page.goto(PAGE)
    await page.getByRole("combobox", { name: "Search judges" }).fill("woodlock")
    await page.getByRole("option", { name: /Woodlock/ }).click()

    const viewport = page.locator("[data-drilldown-viewport]")
    await expect(viewport).toHaveAttribute("data-view", "child")
    await expect(viewport).not.toHaveAttribute("aria-busy", "true")

    const pane = page.locator("[data-drilldown-pane][data-open]")
    await expect(pane.locator("[data-drilldown-pane-title]")).toHaveText("D. Mass.")
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

  test("a region's asset is composed server-side and served as JSON", async ({ page }) => {
    const region = await page.request.get(`${PAGE}/regions/ca8`)
    expect(region.ok()).toBe(true)
    expect(region.headers()["content-type"]).toContain("application/json")
    const asset = (await region.json()) as {
      paths: { id: string | null }[]
      payload: { records: { items: unknown[] }; facts?: unknown; seats?: unknown }
    }
    expect(asset.paths.filter((p) => p.id).length).toBe(11)
    expect(asset.payload.records.items.length).toBeGreaterThan(50)
    // Presentation-wide settings live on the overview, never repeated per region.
    expect(asset.payload.facts).toBeUndefined()
    expect(asset.payload.seats).toBeUndefined()
  })

  test("a region that is not drillable is a 404", async ({ page }) => {
    const res = await page.request.get(`${PAGE}/regions/moed`)
    expect(res.status()).toBe(404)
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

    await items.first().focus()
    for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowRight")
    await expect(page.locator("[data-drilldown-selector] button:focus")).toHaveAttribute(
      "data-region-item",
      "ca8",
    )

    // Enter selects and hands focus to the pane's heading, so the bench is where the reader is.
    await page.keyboard.press("Enter")
    const title = page.locator("[data-drilldown-pane][data-open] [data-drilldown-pane-title]")
    await expect(title).toHaveText("8th Cir.")
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
