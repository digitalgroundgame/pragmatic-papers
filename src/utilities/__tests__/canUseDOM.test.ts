import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// canUseDOM is evaluated once at import, so each case re-imports it.
const load = async (): Promise<boolean> => (await import("@/utilities/canUseDOM")).default

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("canUseDOM", () => {
  it("is true in a browser", async () => {
    expect(await load()).toBe(true)
  })

  it("is false on the server, where there is no window", async () => {
    vi.stubGlobal("window", undefined)

    expect(await load()).toBe(false)
  })

  it("is false when window has no document", async () => {
    vi.stubGlobal("window", {})

    expect(await load()).toBe(false)
  })
})
