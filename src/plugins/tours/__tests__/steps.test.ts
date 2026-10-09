import { describe, expect, it } from "vitest"

import { TOURS, tourHref } from "../registry"
import { canGoBack, isOpenable, matchesPath, parseProgress, placeStep } from "../steps"
import type { Tour } from "../types"

const tour: Tour = {
  key: "demo",
  title: "Demo",
  steps: [
    { path: "/admin", title: "Dashboard", description: "a" },
    { path: "/admin/collections/articles", title: "List", description: "b" },
    { path: "/admin/collections/articles", title: "Search", description: "c" },
    { path: "/admin/collections/articles/:id", title: "Edit", description: "d" },
  ],
}

describe("matchesPath", () => {
  it("matches a page exactly, ignoring a trailing slash", () => {
    expect(matchesPath("/admin", "/admin")).toBe(true)
    expect(matchesPath("/admin", "/admin/")).toBe(true)
    expect(matchesPath("/admin", "/admin/collections/articles")).toBe(false)
  })

  it("lets a :param segment stand for any one segment", () => {
    expect(matchesPath("/admin/collections/articles/:id", "/admin/collections/articles/20")).toBe(
      true,
    )
    expect(matchesPath("/admin/collections/articles/:id", "/admin/collections/articles")).toBe(
      false,
    )
    expect(
      matchesPath("/admin/collections/articles/:id", "/admin/collections/articles/20/versions"),
    ).toBe(false)
  })
})

describe("placeStep", () => {
  it("shows a step on its page", () => {
    expect(placeStep(tour.steps[3]!, "/admin/collections/articles/7")).toEqual({ action: "show" })
  })

  it("opens a step's page when it has no :param", () => {
    expect(isOpenable("/admin/collections/articles")).toBe(true)
    expect(placeStep(tour.steps[1]!, "/admin")).toEqual({
      action: "open",
      path: "/admin/collections/articles",
    })
  })

  it("gives up on a :param page the reader isn't on", () => {
    expect(isOpenable("/admin/collections/articles/:id")).toBe(false)
    expect(placeStep(tour.steps[3]!, "/admin")).toEqual({ action: "end" })
  })
})

describe("canGoBack", () => {
  it("only goes back to a step on the same page", () => {
    expect(canGoBack(tour, 0)).toBe(false)
    expect(canGoBack(tour, 1)).toBe(false)
    expect(canGoBack(tour, 2)).toBe(true)
    expect(canGoBack(tour, 3)).toBe(false)
  })
})

describe("parseProgress", () => {
  const tours = { demo: tour }

  it("reads stored progress", () => {
    expect(parseProgress(JSON.stringify({ key: "demo", step: 2 }), tours)).toEqual({
      key: "demo",
      step: 2,
    })
  })

  it("drops progress that's missing, malformed or out of date", () => {
    expect(parseProgress(null, tours)).toBeNull()
    expect(parseProgress("{", tours)).toBeNull()
    expect(parseProgress(JSON.stringify({ key: "gone", step: 0 }), tours)).toBeNull()
    expect(parseProgress(JSON.stringify({ key: "demo", step: 9 }), tours)).toBeNull()
    expect(parseProgress(JSON.stringify({ key: "demo" }), tours)).toBeNull()
  })
})

describe("TOURS", () => {
  it.each(Object.entries(TOURS))("%s can start from its link", (key, each) => {
    expect(each.key).toBe(key)
    expect(each.steps.length).toBeGreaterThan(0)
    // The first page has to open by itself: a tour starts from a link, not from a document.
    expect(isOpenable(each.steps[0]!.path)).toBe(true)
    expect(tourHref(key)).toBe(`/admin?tour=${key}`)
  })

  it.each(Object.entries(TOURS))("%s reaches every :param page by following a link", (_, each) => {
    each.steps.forEach((step, i) => {
      if (isOpenable(step.path)) return
      const previous = each.steps[i - 1]
      // Either already on this page, or the step before opens it with Next.
      expect(previous?.path === step.path || previous?.follow).toBe(true)
    })
  })
})
