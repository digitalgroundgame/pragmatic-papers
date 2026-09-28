import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AdSlotView } from "../AdSlotView"
import type { AdSlot } from "../types"

const donation: AdSlot = {
  id: "support",
  eyebrow: "Support us",
  title: "Reader-funded",
  body: "Chip in.",
  ctaLabel: "Donate",
  ctaHref: "/donate",
  variant: "donation",
}

function renderAd(props: Partial<React.ComponentProps<typeof AdSlotView>> = {}) {
  const onEndReached = vi.fn()
  const onAutoPlayToggle = vi.fn()
  render(
    <AdSlotView
      ad={donation}
      active
      autoPlayEnabled
      userAutoPlayEnabled
      onAutoPlayToggle={onAutoPlayToggle}
      onEndReached={onEndReached}
      {...props}
    />,
  )
  return { onEndReached, onAutoPlayToggle }
}

describe("AdSlotView", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
        "setTimeout",
        "Date",
      ],
    })
  })
  afterEach(() => vi.useRealTimers())

  it("keeps internal calls to action in the same tab", () => {
    renderAd()
    const cta = screen.getByRole("link", { name: "Donate" })
    expect(cta).toHaveAttribute("href", "/donate")
    expect(cta).not.toHaveAttribute("target")
  })

  it("opens external calls to action safely in a new tab", () => {
    renderAd({ ad: { ...donation, ctaHref: "https://example.com", variant: "external" } })
    const cta = screen.getByRole("link", { name: "Donate" })
    expect(cta).toHaveAttribute("target", "_blank")
    expect(cta).toHaveAttribute("rel", expect.stringContaining("noopener"))
  })

  it("moves on after its dwell while active and playing", () => {
    const { onEndReached } = renderAd()
    act(() => vi.advanceTimersByTime(5000))
    expect(onEndReached).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1500))
    expect(onEndReached).toHaveBeenCalledOnce()
  })

  it("stays put while paused", () => {
    const { onEndReached } = renderAd({ autoPlayEnabled: false })
    act(() => vi.advanceTimersByTime(10_000))
    expect(onEndReached).not.toHaveBeenCalled()
  })

  it("toggles auto-play on a tap, but not on a tap of the call to action", () => {
    const { onAutoPlayToggle } = renderAd()
    const heading = screen.getByRole("heading", { name: "Reader-funded" })

    fireEvent.pointerDown(heading, { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(heading, { clientX: 11, clientY: 11 })
    expect(onAutoPlayToggle).toHaveBeenCalledOnce()

    const cta = screen.getByRole("link", { name: "Donate" })
    fireEvent.pointerDown(cta, { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(cta, { clientX: 10, clientY: 10 })
    expect(onAutoPlayToggle).toHaveBeenCalledOnce()

    // A drag isn't a tap.
    fireEvent.pointerDown(heading, { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(heading, { clientX: 200, clientY: 10 })
    expect(onAutoPlayToggle).toHaveBeenCalledOnce()
  })

  it("starts a new ad's progress from zero", () => {
    const props = {
      active: true,
      autoPlayEnabled: true,
      userAutoPlayEnabled: true,
      onAutoPlayToggle: vi.fn(),
      onEndReached: vi.fn(),
    }
    const { rerender, container } = render(<AdSlotView ad={donation} {...props} />)
    const fill = () => container.querySelector<HTMLElement>(".origin-left")
    act(() => vi.advanceTimersByTime(3000))
    expect(fill()?.style.transform).not.toBe("scaleX(0)")

    rerender(<AdSlotView ad={{ ...donation, id: "another" }} {...props} />)
    expect(fill()?.style.transform).toBe("scaleX(0)")
  })
})
