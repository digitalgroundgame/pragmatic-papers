import { act, cleanup, renderHook } from "@testing-library/react"
import React from "react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { markSeen, resetSeenStore, SEEN_KEY_PREFIX, useIsUnseen } from "../store"

beforeEach(() => {
  localStorage.clear()
  resetSeenStore()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// Another tab writing localStorage: the browser updates storage and fires `storage` here.
function writeFromAnotherTab(key: string | null, value: string | null): void {
  if (key === null) localStorage.clear()
  else if (value === null) localStorage.removeItem(key)
  else localStorage.setItem(key, value)
  act(() => {
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: value }))
  })
}

function Probe({ name }: { name: string }): React.ReactNode {
  return <span>{useIsUnseen(name) ? "dot" : "no dot"}</span>
}

describe("the seen store", () => {
  it("counts a dot as unseen on a first visit", () => {
    const { result } = renderHook(() => useIsUnseen("new-feature"))

    expect(result.current).toBe(true)
  })

  it("remembers a dot once seen, under the notification-dot: prefix", () => {
    const { result } = renderHook(() => useIsUnseen("new-feature"))

    act(() => markSeen("new-feature"))

    expect(result.current).toBe(false)
    expect(localStorage.getItem(`${SEEN_KEY_PREFIX}new-feature`)).toBe("1")
  })

  it("keeps a dot seen on the next page load", () => {
    localStorage.setItem(`${SEEN_KEY_PREFIX}new-feature`, "1")

    const { result } = renderHook(() => useIsUnseen("new-feature"))

    expect(result.current).toBe(false)
  })

  it("only marks the dot it was given", () => {
    const { result } = renderHook(() => ({
      newFeature: useIsUnseen("new-feature"),
      other: useIsUnseen("other-feature"),
    }))

    act(() => markSeen("new-feature"))

    expect(result.current).toEqual({ newFeature: false, other: true })
  })

  it("does not write again for a dot already seen", () => {
    act(() => markSeen("new-feature"))
    const setItem = vi.spyOn(Storage.prototype, "setItem")

    act(() => markSeen("new-feature"))

    expect(setItem).not.toHaveBeenCalled()
  })

  it("picks up a dot seen in another tab", () => {
    const { result } = renderHook(() => useIsUnseen("new-feature"))

    writeFromAnotherTab(`${SEEN_KEY_PREFIX}new-feature`, "1")

    expect(result.current).toBe(false)
  })

  it("shows a dot again when another tab clears storage", () => {
    localStorage.setItem(`${SEEN_KEY_PREFIX}new-feature`, "1")
    const { result } = renderHook(() => useIsUnseen("new-feature"))

    writeFromAnotherTab(null, null)

    expect(result.current).toBe(true)
  })

  it("ignores another tab's writes to keys it doesn't own", () => {
    const renders = vi.fn()
    renderHook(() => renders(useIsUnseen("new-feature")))
    renders.mockClear()

    writeFromAnotherTab("theme", "dark")

    expect(renders).not.toHaveBeenCalled()
  })

  it("counts every dot as seen on the server, so nothing renders there", () => {
    expect(renderToString(<Probe name="new-feature" />)).toContain("no dot")
  })

  describe("when localStorage is blocked", () => {
    it("shows no dot if storage can't be read", () => {
      localStorage.setItem("unrelated", "1")
      vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
        throw new DOMException("The operation is insecure.", "SecurityError")
      })

      const { result } = renderHook(() => useIsUnseen("new-feature"))

      expect(result.current).toBe(false)
    })

    it("still clears the dot for this page if storage can't be written", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError")
      })
      const { result } = renderHook(() => useIsUnseen("new-feature"))

      expect(() => act(() => markSeen("new-feature"))).not.toThrow()
      expect(result.current).toBe(false)
    })
  })
})
