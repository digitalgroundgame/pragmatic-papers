// @vitest-environment node
import { describe, expect, it } from "vitest"

import { readerContentChanged } from "../setContentUpdatedAt"

const content = (text: string) => ({
  root: {
    type: "root",
    version: 1,
    children: [{ type: "paragraph", version: 1, children: [{ type: "text", text }] }],
  },
})

describe("readerContentChanged", () => {
  it("ignores key order, which Postgres's jsonb doesn't keep", () => {
    const stored = { root: { version: 1, children: content("Hi").root.children, type: "root" } }

    expect(
      readerContentChanged({ content: stored as never }, { content: content("Hi") as never }),
    ).toBe(false)
  })

  it("treats a populated relationship as the document it points at", () => {
    const populated = { id: 7, name: "Ada", createdAt: "x", updatedAt: "y" }

    expect(
      readerContentChanged(
        { authors: [7], heroImage: 3 },
        {
          authors: [populated as never],
          heroImage: { id: 3, updatedAt: "y" } as never,
        },
      ),
    ).toBe(false)
  })

  it("treats a missing value as empty", () => {
    expect(readerContentChanged({ heroImage: null }, {})).toBe(false)
  })

  it("sees a changed title, text, hero image, author list or narration", () => {
    expect(readerContentChanged({ title: "A" }, { title: "B" })).toBe(true)
    expect(
      readerContentChanged({ content: content("A") as never }, { content: content("B") as never }),
    ).toBe(true)
    expect(readerContentChanged({ heroImage: 1 }, { heroImage: 2 })).toBe(true)
    expect(readerContentChanged({ authors: [1, 2] }, { authors: [2, 1] })).toBe(true)
    expect(readerContentChanged({ narration: null }, { narration: 4 })).toBe(true)
  })

  it("leaves out fields readers don't see on the page", () => {
    expect(
      readerContentChanged(
        { title: "A", syndicateToSubstack: false, topics: [1] } as never,
        { title: "A", syndicateToSubstack: true, topics: [2] } as never,
      ),
    ).toBe(false)
  })
})
