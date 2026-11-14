import { cleanup, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Interactive } from "@/payload-types"
import { whipCountData } from "@/stories/fixtures/whipCount"

const { draft, find, view } = vi.hoisted(() => ({
  draft: { isEnabled: false },
  find: vi.fn(),
  view: vi.fn(),
}))

vi.mock("next/headers", () => ({ draftMode: async () => draft }))
vi.mock("@/data/payload", () => ({ getPayloadClient: async () => ({ find }) }))
vi.mock("@/components/RichText", () => ({ default: () => <div data-testid="intro" /> }))
vi.mock("@/blocks/InteractiveMap/Sources", () => ({
  Sources: () => <div data-testid="sources" />,
}))
// The count has tests of its own; here it is a marker that records what it was given.
vi.mock("../WhipCount", () => ({
  WhipCount: (props: unknown) => {
    view(props)
    return <div data-testid="whip-count" />
  },
}))

import { loadWhipCount } from "../load"
import { WhipCountPage } from "../WhipCountPage"

const interactive = {
  id: 3,
  slug: "leader",
  title: "Who will lead?",
  profile: "whip-count",
  intro: { root: { children: [] } },
  methodology: "Counted from statements on the record.",
  sources: [],
} as unknown as Interactive

const renderPage = async (doc: Interactive = interactive) =>
  render((await WhipCountPage({ interactive: doc })) as React.ReactElement)

beforeEach(() => {
  vi.clearAllMocks()
  draft.isEnabled = false
  find.mockResolvedValue({ docs: [{ id: 7, data: whipCountData }] })
})
afterEach(cleanup)

describe("loadWhipCount", () => {
  it("reads the published snapshot for readers, and the newest draft in preview", async () => {
    await expect(loadWhipCount({ id: 3 })).resolves.toMatchObject({ success: true })
    expect(find.mock.calls[0]).toMatchObject([
      {
        collection: "interactive-snapshots",
        where: { interactive: { equals: 3 } },
        draft: false,
        overrideAccess: false,
      },
    ])
    draft.isEnabled = true
    await loadWhipCount({ id: 4 })
    expect(find.mock.calls[1]).toMatchObject([{ draft: true, overrideAccess: true }])
  })

  it("says why there is no count", async () => {
    find.mockResolvedValue({ docs: [] })
    await expect(loadWhipCount({ id: 5 })).resolves.toEqual({
      success: false,
      error: "no count has been pushed to it yet",
    })
  })
})

describe("WhipCountPage", () => {
  it("draws the title, intro, count, methodology and sources", async () => {
    await renderPage()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Who will lead?")
    expect(screen.getByTestId("intro")).toBeInTheDocument()
    expect(view).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Who will lead?", storageKey: "leader" }),
    )
    expect(screen.getByRole("heading", { name: "How this is counted" })).toBeInTheDocument()
    expect(screen.getByText("Counted from statements on the record.")).toBeInTheDocument()
    expect(screen.getByTestId("sources")).toBeInTheDocument()
  })

  it("leaves out the methodology when there is none", async () => {
    await renderPage({ ...interactive, id: 8, methodology: null })
    expect(screen.queryByRole("heading", { name: "How this is counted" })).not.toBeInTheDocument()
  })

  it("tells readers there is no count yet, and an editor in preview why", async () => {
    find.mockResolvedValue({ docs: [] })
    await renderPage({ ...interactive, id: 9 })
    expect(document.querySelector("[data-whip-count-empty]")).toHaveTextContent(
      "This count has no data yet.",
    )
    expect(view).not.toHaveBeenCalled()
    cleanup()

    draft.isEnabled = true
    await renderPage({ ...interactive, id: 10 })
    expect(document.querySelector("[data-whip-count-empty]")).toHaveTextContent(
      "This count's data can't be read: no count has been pushed to it yet",
    )
  })
})
