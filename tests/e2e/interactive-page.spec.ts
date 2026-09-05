import { expect, test } from "@playwright/test"

const PAGE = "/interactives/federal-courts"

test.describe("interactive page — federal courts", () => {
  test("renders the overview from the published snapshot with JSON region routes", async ({
    page,
  }) => {
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

    // Seat blocks are drawn once the client adopts the SVG, from facts the snapshot carries.
    await expect(page.locator("svg[data-drilldown-overview] g[data-drilldown-block]")).toHaveCount(
      13,
    )

    // Drilling in fetches a composed JSON asset rather than an SVG upload.
    const ca8 = page.locator(
      "svg[data-drilldown-overview] path[data-region-id='ca8'][data-role='parent']",
    )
    await ca8.click()
    const pane = page.locator("[data-drilldown-pane][data-open]")
    await expect(pane).toBeVisible()
    await expect(pane.locator("h3")).toHaveText("8th Cir.")
    const region = await page.request.get(`${PAGE}/regions/ca8`)
    expect(region.ok()).toBe(true)
    expect(region.headers()["content-type"]).toContain("application/json")
    const asset = (await region.json()) as {
      paths: { id: string | null }[]
      payload: { records: { items: unknown[] } }
    }
    expect(asset.paths.filter((p) => p.id).length).toBe(11)
    expect(asset.payload.records.items.length).toBeGreaterThan(50)
  })

  test("a region that is not drillable is a 404", async ({ page }) => {
    const res = await page.request.get(`${PAGE}/regions/moed`)
    expect(res.status()).toBe(404)
  })
})
