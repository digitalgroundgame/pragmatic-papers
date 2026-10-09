import { expect, test } from "@playwright/test"

const PAGE = "/interactives/federal-courts"

test.describe("interactive page — federal courts", () => {
  test("overview renders from the published snapshot, with prefetchable JSON regions", async ({
    page,
  }) => {
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

    // The pane starts empty, not landed on the Supreme Court. The landing view (the whole
    // bench, parked behind `summary`) is built and tested at the component level
    // (SummaryView.tsx), but the page keeps the pane empty until the reader picks something.
    const emptyPane = page.locator("[data-drilldown-pane]")
    await expect(emptyPane).not.toHaveAttribute("data-open", "")
    await expect(emptyPane.locator("[data-drilldown-empty]")).toHaveText(
      "Select a court on the map or from the list to see who sits on its bench.",
    )
    await expect(emptyPane.locator("[data-summary-scotus]")).toHaveCount(0)

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

    // The drilled-in region, the open pane and the pinned judge survive a reload through the
    // URL. The map only writes the URL once its camera settles, so wait for all three first:
    // reloading mid-flight comes back on the overview with no pane.
    await expect(page).toHaveURL(/[?&]region=ca8(&|$)/)
    await expect(page).toHaveURL(/[?&]pane=1(&|$)/)
    await expect(page).toHaveURL(/[?&]record=[^&]+/)
    const pinnedCard = (await detail.textContent()) ?? ""
    await page.reload()

    // Restoring is a fetch and a camera move: the pane opens on the region once its records
    // have arrived, and the card is pinned once the bench is drawn. Wait on each in turn, so a
    // failure says which part of the address was lost.
    const restored = page.locator("[data-drilldown-pane][data-open]")
    await expect(restored.locator("[data-drilldown-pane-title]")).toHaveText(
      "U.S. Court of Appeals for the Eighth Circuit",
    )
    await expect(restored.locator("[data-drilldown-node]").first()).toBeVisible()
    const restoredDetail = restored.locator("[data-drilldown-detail]")
    await expect(restoredDetail).toHaveAttribute("data-pinned", "")
    await expect(restoredDetail).toHaveText(pinnedCard)
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
