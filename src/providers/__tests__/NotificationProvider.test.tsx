import { act, cleanup, render, renderHook, screen } from "@testing-library/react"
import React from "react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  NotificationProvider,
  resetNotificationStore,
  useNotification,
} from "../NotificationProvider"

beforeEach(() => {
  localStorage.clear()
  resetNotificationStore()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// Another tab writing localStorage: the browser updates storage and fires `storage` here.
function writeFromAnotherTab(key: string, value: string | null): void {
  if (value === null) localStorage.removeItem(key)
  else localStorage.setItem(key, value)
  act(() => {
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: value }))
  })
}

function Probe({ name }: { name: string }): React.ReactNode {
  const { visible } = useNotification(name)
  return <span>{visible ? "dot" : "no dot"}</span>
}

describe("useNotification", () => {
  it("shows the dot on a first visit", () => {
    const { result } = renderHook(() => useNotification("new-feature"))

    expect(result.current.loaded).toBe(true)
    expect(result.current.visible).toBe(true)
  })

  it("hides the dot once seen, and remembers it in localStorage", () => {
    const { result } = renderHook(() => useNotification("new-feature"))

    act(() => result.current.markSeen())

    expect(result.current.visible).toBe(false)
    expect(localStorage.getItem("pp:seen:new-feature")).toBe("1")
  })

  it("keeps the dot hidden on the next page load", () => {
    localStorage.setItem("pp:seen:new-feature", "1")

    const { result } = renderHook(() => useNotification("new-feature"))

    expect(result.current.visible).toBe(false)
  })

  it("only clears the dot it was asked to", () => {
    const { result } = renderHook(() => ({
      newFeature: useNotification("new-feature"),
      theme: useNotification("theme-selector"),
    }))

    act(() => result.current.newFeature.markSeen())

    expect(result.current.newFeature.visible).toBe(false)
    expect(result.current.theme.visible).toBe(true)
  })

  it("updates every component showing the same dot", () => {
    render(
      <>
        <Probe name="theme-selector" />
        <Probe name="theme-selector" />
      </>,
    )
    const { result } = renderHook(() => useNotification("theme-selector"))

    act(() => result.current.markSeen())

    expect(screen.getAllByText("no dot")).toHaveLength(2)
  })

  it("does not write again for a dot already seen", () => {
    const { result } = renderHook(() => useNotification("new-feature"))
    act(() => result.current.markSeen())
    const setItem = vi.spyOn(Storage.prototype, "setItem")

    act(() => result.current.markSeen())

    expect(setItem).not.toHaveBeenCalled()
  })

  it("picks up a dot seen in another tab", () => {
    const { result } = renderHook(() => useNotification("new-feature"))
    expect(result.current.visible).toBe(true)

    writeFromAnotherTab("pp:seen:new-feature", "1")

    expect(result.current.visible).toBe(false)
  })

  it("shows the dot again when another tab clears storage", () => {
    localStorage.setItem("pp:seen:new-feature", "1")
    const { result } = renderHook(() => useNotification("new-feature"))
    expect(result.current.visible).toBe(false)

    localStorage.clear()
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }))
    })

    expect(result.current.visible).toBe(true)
  })

  it("ignores another tab's writes to keys it doesn't own", () => {
    const { result } = renderHook(() => useNotification("new-feature"))
    const before = result.current

    writeFromAnotherTab("theme", "dark")

    expect(result.current).toBe(before)
  })

  it("renders no dot on the server", () => {
    localStorage.clear()

    expect(renderToString(<Probe name="new-feature" />)).toContain("no dot")
  })

  describe("last visited", () => {
    it("is null before the first visit", () => {
      const { result } = renderHook(() => useNotification("topic:economy"))

      expect(result.current.getLastVisited()).toBeNull()
    })

    it("records the time of a visit", () => {
      vi.useFakeTimers({ toFake: ["Date"] })
      vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"))
      const { result } = renderHook(() => useNotification("topic:economy"))

      act(() => result.current.setLastVisited())

      expect(localStorage.getItem("pp:lastVisited:topic:economy")).toBe("2026-09-01T12:00:00.000Z")
      expect(result.current.getLastVisited()).toEqual(new Date("2026-09-01T12:00:00.000Z"))
    })

    it("reads a visit stored on an earlier page load", () => {
      localStorage.setItem("pp:lastVisited:topic:economy", "2026-08-01T00:00:00.000Z")

      const { result } = renderHook(() => useNotification("topic:economy"))

      expect(result.current.getLastVisited()).toEqual(new Date("2026-08-01T00:00:00.000Z"))
    })

    it("treats an unreadable timestamp as no visit", () => {
      localStorage.setItem("pp:lastVisited:topic:economy", "not a date")

      const { result } = renderHook(() => useNotification("topic:economy"))

      expect(result.current.getLastVisited()).toBeNull()
    })

    it("does not count as seeing the dot", () => {
      const { result } = renderHook(() => useNotification("topic:economy"))

      act(() => result.current.setLastVisited())

      expect(result.current.visible).toBe(true)
    })
  })

  describe("when localStorage is blocked", () => {
    it("shows no dot if storage can't be read", () => {
      vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
        throw new DOMException("The operation is insecure.", "SecurityError")
      })
      localStorage.setItem("pp:unrelated", "1")

      const { result } = renderHook(() => useNotification("new-feature"))

      expect(result.current.loaded).toBe(false)
      expect(result.current.visible).toBe(false)
    })

    it("still clears the dot for this page if storage can't be written", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError")
      })
      const { result } = renderHook(() => useNotification("new-feature"))

      expect(() => act(() => result.current.markSeen())).not.toThrow()
      expect(result.current.visible).toBe(false)
      expect(() => act(() => result.current.setLastVisited())).not.toThrow()
      expect(result.current.getLastVisited()).toBeInstanceOf(Date)
    })
  })
})

describe("NotificationProvider", () => {
  it("renders its children", () => {
    render(
      <NotificationProvider>
        <p>Page</p>
      </NotificationProvider>,
    )

    expect(screen.getByText("Page")).toBeInTheDocument()
  })
})
