import { beforeEach, describe, expect, it, vi } from "vitest"

const isExperimentEnabled = vi.fn()

vi.mock("@/globals/SiteSettings/isExperimentEnabled", () => ({ isExperimentEnabled }))

const { cornerAttributes } = await import("../cornerAttributes")

describe("cornerAttributes", () => {
  beforeEach(() => {
    isExperimentEnabled.mockReset()
  })

  it("marks <html> square when the experiment is on", async () => {
    isExperimentEnabled.mockResolvedValue(true)

    expect(await cornerAttributes()).toEqual({ "data-corners": "square" })
    expect(isExperimentEnabled).toHaveBeenCalledWith("squareCorners")
  })

  it("adds nothing when the experiment is off", async () => {
    isExperimentEnabled.mockResolvedValue(false)

    expect(await cornerAttributes()).toEqual({})
  })
})
