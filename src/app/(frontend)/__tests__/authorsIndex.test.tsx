import { cleanup, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { authors } from "@/stories/fixtures/docs"

const { find } = vi.hoisted(() => ({ find: vi.fn() }))

vi.mock("next/headers", () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock("@payload-config", () => ({ default: {} }))
vi.mock("payload", () => ({ getPayload: async () => ({ find }) }))
vi.mock("@/components/LivePreviewListener", () => ({ LivePreviewListener: () => null }))

const { default: AuthorsIndexPage } = await import("../authors/page")

/** Every element in the tree, without rendering its children. */
function elements(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== "object" || !("props" in node)) return []
  const el = node as React.ReactElement<Record<string, unknown>>
  return [el, ...elements(el.props.children as React.ReactNode)]
}

/** Renders the page, resolving the async author list it streams in behind Suspense. */
async function renderPage(p?: string) {
  const tree = await AuthorsIndexPage({ searchParams: Promise.resolve({ p }) })
  const content = elements(tree).find(
    (el) => typeof el.type === "function" && el.type.name === "AuthorContent",
  )!
  const AuthorContent = content.type as (props: object) => Promise<React.ReactNode>
  render(<>{await AuthorContent(content.props)}</>)
}

beforeEach(() => {
  vi.clearAllMocks()
  find.mockResolvedValue({ docs: authors, totalDocs: authors.length, totalPages: 1, page: 1 })
})
afterEach(cleanup)

describe("authors index", () => {
  it("lists authors by role or by a public profile, so a demoted author stays listed", async () => {
    await renderPage()

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "users",
        page: 1,
        where: {
          or: [
            { roles: { in: ["writer", "editor", "chief-editor", "narrator"] } },
            { publicProfile: { equals: true } },
          ],
        },
      }),
    )
    for (const author of authors) {
      expect(screen.getByRole("link", { name: author.name! })).toHaveAttribute(
        "href",
        `/authors/${author.slug}`,
      )
    }
  })

  it.each([
    ["3", 3],
    ["0", 1],
    ["nope", 1],
  ])("reads ?p=%s as page %i", async (p, page) => {
    find.mockResolvedValue({ docs: authors, totalDocs: 15, totalPages: 3, page })
    await renderPage(p)
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ page }))
  })

  it("404s past the last page", async () => {
    await expect(renderPage("2")).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404")
  })

  it("says so when there are no authors", async () => {
    find.mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 0, page: 1 })
    await renderPage()
    expect(screen.getByText("No authors found.")).toBeInTheDocument()
  })
})
