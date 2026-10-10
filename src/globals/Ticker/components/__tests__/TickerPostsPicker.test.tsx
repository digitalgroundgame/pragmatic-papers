import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { TickerPost } from "@/components/Ticker/items"
import { tickerPosts } from "@/stories/fixtures/ticker"

import { TickerPostsPicker } from "../TickerPostsPicker"
import { tickerPostStatuses } from "../TickerPostsTable"

type FormFields = Record<string, { value?: unknown; rows?: unknown[] }>

const addFieldRow = vi.fn()
const removeFieldRow = vi.fn()
let formFields: FormFields = {}

vi.mock("@payloadcms/ui", () => ({
  useForm: () => ({ addFieldRow, removeFieldRow, disabled: false }),
  useFormFields: (selector: (state: [FormFields]) => unknown) => selector([formFields]),
}))

afterEach(() => {
  cleanup()
  addFieldRow.mockClear()
  removeFieldRow.mockClear()
  formFields = {}
})

function setHidden(urls: string[]): void {
  formFields = { hidden: { rows: urls.map(() => ({})) } }
  urls.forEach((url, i) => (formFields[`hidden.${i}.url`] = { value: url }))
}

const [bluesky, x] = tickerPosts as [TickerPost, TickerPost]

describe("TickerPostsPicker", () => {
  it("adds a post's link to Hidden posts when Hide is clicked", () => {
    setHidden(["https://bsky.app/profile/someone.bsky.social/post/old"])
    render(<TickerPostsPicker lists={[[bluesky], [x]]} />)
    const row = screen.getByRole("row", { name: /filibuster/ })
    expect(row).toHaveTextContent("On the ticker")
    fireEvent.click(within(row).getByRole("button", { name: /^Hide/ }))
    expect(addFieldRow).toHaveBeenCalledWith({
      path: "hidden",
      schemaPath: "hidden",
      rowIndex: 1,
      subFieldState: { url: { initialValue: x.url, value: x.url, valid: true } },
    })
  })

  it("shows a hidden post again by removing its rows, however its link was written", () => {
    setHidden([
      "https://twitter.com/PragPapers/status/2?s=20",
      "https://bsky.app/profile/someone.bsky.social/post/old",
      x.url,
    ])
    render(<TickerPostsPicker lists={[[bluesky], [x]]} />)
    const row = screen.getByRole("row", { name: /filibuster/ })
    expect(row).toHaveTextContent("Hidden")
    fireEvent.click(within(row).getByRole("button", { name: /^Show/ }))
    expect(removeFieldRow.mock.calls).toEqual([
      [{ path: "hidden", rowIndex: 2 }],
      [{ path: "hidden", rowIndex: 0 }],
    ])
    expect(addFieldRow).not.toHaveBeenCalled()
  })

  it("says so when the sources have nothing", () => {
    render(<TickerPostsPicker lists={[[], []]} />)
    expect(screen.getByText(/No posts right now/)).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})

describe("tickerPostStatuses", () => {
  const post = (id: string, hour: number, text = id): TickerPost => ({
    id,
    source: "x",
    text,
    links: [],
    url: `https://x.com/P/status/${id}`,
    createdAt: `2026-10-08T${String(hour).padStart(2, "0")}:00:00Z`,
  })

  it("lists newest first; past the newest eight, and a newer post's twin, aren't shown", () => {
    const posts = Array.from({ length: 9 }, (_, i) => post(String(i + 1), i + 1))
    const twin = { ...post("20", 0, "9"), source: "bluesky" as const }
    const rows = tickerPostStatuses([posts, [twin]], [])
    expect(rows.map((row) => [row.post.id, row.status])).toEqual([
      ["9", "shown"],
      ["8", "shown"],
      ["7", "shown"],
      ["6", "shown"],
      ["5", "shown"],
      ["4", "shown"],
      ["3", "shown"],
      ["2", "shown"],
      ["1", "waiting"],
      ["20", "waiting"],
    ])
  })

  it("moves the next newest up when one is hidden", () => {
    const posts = Array.from({ length: 9 }, (_, i) => post(String(i + 1), i + 1))
    const rows = tickerPostStatuses([posts], ["https://x.com/P/status/9"])
    expect(rows[0]).toMatchObject({ status: "hidden" })
    expect(rows.at(-1)).toMatchObject({ post: { id: "1" }, status: "shown" })
  })
})
