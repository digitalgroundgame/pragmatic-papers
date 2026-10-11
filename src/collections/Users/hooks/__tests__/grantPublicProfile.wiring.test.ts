// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

// Stands in for the real hook and keeps the reader each collection registers it with,
// so the test checks what a collection credits rather than re-running the hook.
vi.mock("@/collections/Users/hooks/grantPublicProfile", () => ({
  grantPublicProfile: (credited: (doc: unknown) => unknown) =>
    Object.assign(async () => undefined, { credited }),
}))

const { Articles } = await import("@/collections/Articles")
const { Media } = await import("@/collections/Media")

/** The reader a collection registered `grantPublicProfile` with. */
function creditReader(collection: { hooks?: { afterChange?: unknown[] } }) {
  const readers = (collection.hooks?.afterChange ?? []).flatMap((hook) =>
    typeof hook === "function" && "credited" in hook
      ? [(hook as unknown as { credited: (doc: unknown) => unknown }).credited]
      : [],
  )
  expect(readers).toHaveLength(1)
  return readers[0]!
}

describe("grantPublicProfile wiring", () => {
  it("credits an article's authors", () => {
    const read = creditReader(Articles)
    expect(read({ authors: [1, { id: 2 }] })).toEqual([1, { id: 2 }])
    expect(read({ authors: null })).toEqual([])
  })

  it("credits a narration's narrator", () => {
    const read = creditReader(Media)
    expect(read({ narrator: 3 })).toBe(3)
    expect(read({ narrator: null })).toBeNull()
  })
})
