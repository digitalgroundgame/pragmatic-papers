import { beforeEach, describe, expect, it, vi } from "vitest"

const { getGlobal } = vi.hoisted(() => ({ getGlobal: vi.fn() }))
vi.mock("@/data/globals", () => ({ getGlobal }))

import { isPluginEnabled } from "../isPluginEnabled"

describe("isPluginEnabled", () => {
  beforeEach(() => getGlobal.mockReset())

  it("reads the plugin's switch from the Plugins global", async () => {
    getGlobal.mockResolvedValue({ switches: { docs: true, tours: false } })
    expect(await isPluginEnabled("docs")).toBe(true)
    expect(await isPluginEnabled("tours")).toBe(false)
    expect(getGlobal).toHaveBeenCalledWith("plugins")
  })

  it("is off when the switch was never saved", async () => {
    getGlobal.mockResolvedValue({})
    expect(await isPluginEnabled("sso")).toBe(false)
  })
})
