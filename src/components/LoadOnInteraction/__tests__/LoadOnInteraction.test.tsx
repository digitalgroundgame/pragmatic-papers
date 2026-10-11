import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { LoadOnInteraction } from ".."

afterEach(cleanup)

interface RealProps {
  label: string
  onPress: () => void
}

/** Stands in for the interactive component: the same controls as the placeholder. */
function Real({ label, onPress }: RealProps): React.ReactNode {
  return (
    <>
      <a href="/about">About</a>
      <button type="button" onClick={onPress} data-real="">
        {label}
      </button>
    </>
  )
}

/** A load the test resolves (or rejects) by hand. */
function deferredLoad() {
  const pending: { resolve: (c: typeof Real) => void; reject: (e: unknown) => void }[] = []
  const load = vi.fn(
    () =>
      new Promise<typeof Real>((resolve, reject) => {
        pending.push({ resolve, reject })
      }),
  )
  const settle = async (ok = true) =>
    act(async () => {
      for (const { resolve, reject } of pending.splice(0)) {
        if (ok) resolve(Real)
        else reject(new Error("chunk failed"))
      }
    })
  return { load, settle }
}

function renderGate(load: () => Promise<typeof Real>, onPress = vi.fn()) {
  render(
    <LoadOnInteraction load={load} props={{ label: "Open", onPress }}>
      <a href="/about">About</a>
      <button type="button">Open</button>
    </LoadOnInteraction>,
  )
  return { onPress }
}

const real = () => screen.getByRole("button", { name: "Open" }).hasAttribute("data-real")

describe("LoadOnInteraction", () => {
  it("renders the placeholder, and loads nothing, until the reader reaches for it", () => {
    const { load } = deferredLoad()
    renderGate(load)
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about")
    expect(real()).toBe(false)
    expect(load).not.toHaveBeenCalled()
  })

  it.each([
    ["pointing at it", (el: HTMLElement) => fireEvent.pointerOver(el)],
    ["focusing it", (el: HTMLElement) => fireEvent.focus(el)],
    ["touching it", (el: HTMLElement) => fireEvent.touchStart(el)],
  ])("swaps in the component after %s", async (_, interact) => {
    const { load, settle } = deferredLoad()
    renderGate(load)
    interact(screen.getByRole("button", { name: "Open" }))
    interact(screen.getByRole("button", { name: "Open" }))
    expect(load).toHaveBeenCalledTimes(1)
    await settle()
    expect(real()).toBe(true)
  })

  it("replays a click on a placeholder button once the component is in", async () => {
    const { load, settle } = deferredLoad()
    const { onPress } = renderGate(load)
    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    await settle()
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("doesn't replay a click on a placeholder link, which has already navigated", async () => {
    const { load, settle } = deferredLoad()
    const { onPress } = renderGate(load)
    const about = screen.getByRole("link", { name: "About" })
    about.addEventListener("click", (event) => event.preventDefault())
    fireEvent.click(about)
    await settle()
    expect(real()).toBe(true)
    expect(onPress).not.toHaveBeenCalled()
  })

  it("moves focus to the matching control", async () => {
    const { load, settle } = deferredLoad()
    renderGate(load)
    screen.getByRole("button", { name: "Open" }).focus()
    await settle()
    const button = screen.getByRole("button", { name: "Open" })
    expect(button).toHaveAttribute("data-real")
    expect(button).toHaveFocus()
  })

  it("waits while a pointer is pressed, so the click lands on one element", async () => {
    const { load, settle } = deferredLoad()
    const { onPress } = renderGate(load)
    const placeholder = screen.getByRole("button", { name: "Open" })
    fireEvent.pointerDown(placeholder, { button: 0 })
    await settle()
    expect(real()).toBe(false)

    vi.useFakeTimers()
    try {
      fireEvent.pointerUp(window)
      fireEvent.click(placeholder)
      await act(async () => vi.runAllTimers())
    } finally {
      vi.useRealTimers()
    }
    await act(async () => undefined)
    expect(real()).toBe(true)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("keeps the placeholder when the load fails, and tries again on the next interaction", async () => {
    const { load, settle } = deferredLoad()
    renderGate(load)
    fireEvent.pointerOver(screen.getByRole("button", { name: "Open" }))
    await settle(false)
    expect(real()).toBe(false)

    fireEvent.pointerOver(screen.getByRole("button", { name: "Open" }))
    expect(load).toHaveBeenCalledTimes(2)
    await settle()
    expect(real()).toBe(true)
  })
})
