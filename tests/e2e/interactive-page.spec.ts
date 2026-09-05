import { expect, test } from "@playwright/test"

import { waitForStableRender } from "./helpers"

const PAGE = "/interactives/federal-courts"

test.describe("interactive page — federal courts", () => {
  test("overview renders from the published snapshot, with prefetchable JSON regions @visual", async ({
    page,
  }, testInfo) => {
    await page.goto(PAGE)

    const figure = page.locator("[data-interactive-map-block][data-map-mode='drilldown']")
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
    await expect(pane.locator("h3")).toHaveText("8th Cir.")
    await expect(pane.locator("[data-drilldown-node]").first()).toBeVisible()
    await expect(pane.locator("[data-drilldown-associate-node]")).toContainText("Circ. Justice")

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
    const figure = page.locator("[data-interactive-map-block][data-map-mode='drilldown']")
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
    await expect(page.locator("[data-drilldown-pane][data-open] h3")).toHaveText("E.D. Mo.")

    await page.getByRole("button", { name: "← Back to overview" }).click()
    await expect(viewport).toHaveAttribute("data-view", "overview")
    await expect(viewport).not.toHaveAttribute("aria-busy", "true")
    await expect(page.locator("[data-drilldown-layer='overview']")).toHaveAttribute(
      "data-state",
      "visible",
    )
    await expect(page.locator("[data-drilldown-selector] [data-region-item='ca1']")).toBeVisible()
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
})
