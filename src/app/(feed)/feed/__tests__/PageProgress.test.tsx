import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PageProgress } from "../PageProgress"

function nth<T>(arr: T[], i: number): T {
  const v = arr[i]
  if (v === undefined) throw new Error(`index ${i} out of bounds`)
  return v
}

describe("PageProgress", () => {
  it("renders nothing for a single-page article", () => {
    const { container } = render(
      <PageProgress total={1} activeIndex={0} progress={0.5} onJump={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders one segment per page", () => {
    render(<PageProgress total={4} activeIndex={0} progress={0} onJump={vi.fn()} />)
    expect(screen.getAllByRole("tab")).toHaveLength(4)
  })

  it("fills past segments fully, the active by progress, and future segments empty", () => {
    render(<PageProgress total={3} activeIndex={1} progress={0.4} onJump={vi.fn()} />)
    const fills = screen.getAllByTestId("page-progress-fill") as HTMLElement[]
    expect(nth(fills, 0).style.transform).toBe("scaleX(1)")
    expect(nth(fills, 1).style.transform).toBe("scaleX(0.4)")
    expect(nth(fills, 2).style.transform).toBe("scaleX(0)")
  })

  it("invokes onJump with the tapped index", () => {
    const onJump = vi.fn()
    render(<PageProgress total={3} activeIndex={0} progress={0} onJump={onJump} />)
    const tabs = screen.getAllByRole("tab")
    fireEvent.click(nth(tabs, 2))
    expect(onJump).toHaveBeenCalledWith(2)
  })

  it("marks the active segment with aria-selected", () => {
    render(<PageProgress total={3} activeIndex={2} progress={0.1} onJump={vi.fn()} />)
    const tabs = screen.getAllByRole("tab")
    expect(nth(tabs, 0).getAttribute("aria-selected")).toBe("false")
    expect(nth(tabs, 2).getAttribute("aria-selected")).toBe("true")
  })
})
