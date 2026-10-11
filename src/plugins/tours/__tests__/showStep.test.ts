import { beforeEach, describe, expect, it, vi } from "vitest"

const { driver, drive, destroy } = vi.hoisted(() => ({
  driver: vi.fn(),
  drive: vi.fn(),
  destroy: vi.fn(),
}))
vi.mock("driver.js", () => ({ driver }))

import { showStep } from "../showStep"
import type { Tour } from "../types"

interface DriverConfig {
  showProgress: boolean
  steps: { element?: Element; popover: { title: string; showButtons: string[] } }[]
  onNextClick: () => void
  onPrevClick: () => void
  onDestroyStarted: () => void
}
const config = (): DriverConfig => driver.mock.calls.at(-1)![0] as DriverConfig

const tour: Tour = {
  key: "test",
  title: "Test",
  steps: [
    { path: "/admin", element: "#a", title: "One", description: "1" },
    { path: "/admin/collections/articles", element: "#b", title: "Two", description: "2" },
    { path: "/admin/collections/articles", title: "Three", description: "3" },
  ],
}

const handlers = () => ({ onNext: vi.fn(), onPrevious: vi.fn(), onClose: vi.fn() })

beforeEach(() => {
  vi.clearAllMocks()
  driver.mockReturnValue({ drive, destroy })
})

describe("showStep", () => {
  it("shows only the step it's given, pointing at its element, with every step counted", () => {
    const element = document.createElement("div")
    showStep({ tour, index: 1, element, ...handlers() })

    expect(drive).toHaveBeenCalledWith(1)
    const { steps, showProgress } = config()
    expect(showProgress).toBe(true)
    expect(steps.map((step) => step.popover.title)).toEqual(["One", "Two", "Three"])
    expect(steps.map((step) => step.element)).toEqual([undefined, element, undefined])
  })

  it("offers Back only where the previous step is on the same page", () => {
    showStep({ tour, index: 0, ...handlers() })
    expect(config().steps.map((step) => step.popover.showButtons)).toEqual([
      ["next", "close"],
      ["next", "close"],
      ["next", "previous", "close"],
    ])
  })

  it("leaves out the progress on a tour of one step", () => {
    showStep({ tour: { ...tour, steps: tour.steps.slice(0, 1) }, index: 0, ...handlers() })
    expect(config().showProgress).toBe(false)
  })

  it("hands Next and Back to the provider", () => {
    const on = handlers()
    showStep({ tour, index: 2, ...on })
    config().onNextClick()
    config().onPrevClick()
    expect(on.onNext).toHaveBeenCalledOnce()
    expect(on.onPrevious).toHaveBeenCalledOnce()
    expect(drive).toHaveBeenCalledOnce()
  })

  it("counts the reader closing it as a close", () => {
    const on = handlers()
    showStep({ tour, index: 0, ...on })
    config().onDestroyStarted()
    expect(on.onClose).toHaveBeenCalledOnce()
    expect(destroy).toHaveBeenCalledOnce()
  })

  it("removes the popover without counting it as a close", () => {
    const on = handlers()
    const remove = showStep({ tour, index: 0, ...on })
    remove()
    // driver.js calls back on its way out.
    config().onDestroyStarted()
    expect(on.onClose).not.toHaveBeenCalled()
    expect(destroy).toHaveBeenCalled()
  })
})
