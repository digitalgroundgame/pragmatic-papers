import { cleanup, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { queries } = vi.hoisted(() => ({
  queries: {
    queryPageBySlug: vi.fn(),
    queryTopicBySlug: vi.fn(),
    queryUserBySlug: vi.fn(),
  },
}))

vi.mock("@/utilities/queries", () => queries)

import { Breadcrumbs } from "../index"

type Suspended = React.ReactElement<{
  fallback: React.ReactElement
  children: React.ReactElement<{ pathname: string }>
}>

/**
 * `Breadcrumbs` wraps an async server component in Suspense, which jsdom's client renderer
 * can't await. Resolve the trail the way the server would, then render what it returns.
 */
async function renderTrail(pathname: string): Promise<HTMLElement> {
  const suspended = Breadcrumbs({ pathname }) as Suspended
  const trail = suspended.props.children
  const resolve = trail.type as unknown as (props: {
    pathname: string
  }) => Promise<React.ReactElement>
  const { container } = render(await resolve(trail.props))
  return container.firstElementChild as HTMLElement
}

async function renderSkeleton(pathname: string): Promise<HTMLElement> {
  const suspended = Breadcrumbs({ pathname }) as Suspended
  const { container } = render(suspended.props.fallback)
  return container.firstElementChild as HTMLElement
}

beforeEach(() => {
  vi.clearAllMocks()
  queries.queryPageBySlug.mockResolvedValue(null)
  queries.queryTopicBySlug.mockResolvedValue(null)
  queries.queryUserBySlug.mockResolvedValue(null)
})
afterEach(cleanup)

describe("Breadcrumbs", () => {
  it.each(["/", "/articles/some-story"])("renders nothing on %s", (pathname) => {
    expect(Breadcrumbs({ pathname })).toBeNull()
  })

  it("spans the page on an interactive, which fills the container", async () => {
    const nav = await renderTrail("/interactives/federal-courts")
    expect(nav).toHaveClass("container", "mb-4")
    expect(nav).not.toHaveClass("max-w-3xl")
    expect(screen.getByRole("link", { name: "Interactives" })).toHaveAttribute(
      "href",
      "/interactives",
    )
    expect(screen.getByText("Federal Courts")).toHaveAttribute("aria-current", "page")
  })

  it("stops at the reading column everywhere else", async () => {
    queries.queryPageBySlug.mockResolvedValue({ title: "About Us" })
    const nav = await renderTrail("/about")
    expect(nav).toHaveClass("container", "max-w-3xl")
    expect(screen.getByText("About Us")).toHaveAttribute("aria-current", "page")
  })

  it("keeps the skeleton the same width as the trail it stands in for", async () => {
    expect(await renderSkeleton("/interactives/federal-courts")).not.toHaveClass("max-w-3xl")
    cleanup()
    expect(await renderSkeleton("/topics/elections")).toHaveClass("max-w-3xl")
  })

  it("names authors and topics from their documents", async () => {
    queries.queryUserBySlug.mockResolvedValue({ name: "Jane Doe" })
    queries.queryTopicBySlug.mockResolvedValue({ name: "Local Elections" })
    await renderTrail("/authors/jane-doe")
    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
    expect(queries.queryUserBySlug).toHaveBeenCalledWith("jane-doe")
    cleanup()
    await renderTrail("/topics/local-elections")
    expect(screen.getByText("Local Elections")).toBeInTheDocument()
  })

  it("falls back to a title-cased slug when a document has no name", async () => {
    await renderTrail("/authors/jane-doe")
    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
  })

  it("numbers volumes in roman numerals and never looks up the static roots", async () => {
    await renderTrail("/volumes/12")
    expect(screen.getByRole("link", { name: "Volumes" })).toHaveAttribute("href", "/volumes")
    expect(screen.getByText("Volume XII")).toBeInTheDocument()
    expect(queries.queryPageBySlug).not.toHaveBeenCalled()
  })
})
