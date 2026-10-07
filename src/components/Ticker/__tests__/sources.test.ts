import { afterEach, describe, expect, it, vi } from "vitest"

import type { Integration } from "@/integrations"

import { loadSource, type TickerSource } from "../sources"

const integration = (required: string[]): Integration => ({
  id: "test-source",
  label: "Test source",
  service: "Test",
  describe: () => "test:source",
  required,
})

const source = (
  required: string[],
  load: TickerSource<string[]>["load"],
): TickerSource<string[]> => ({
  integration: integration(required),
  revalidate: 60,
  load,
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("loadSource", () => {
  it("returns what the source loads", async () => {
    expect(
      await loadSource(
        source([], async () => ["a"]),
        [],
      ),
    ).toEqual(["a"])
  })

  it("skips an unconfigured source without calling it, naming what to set", async () => {
    vi.stubEnv("TEST_SOURCE_TOKEN", "")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const load = vi.fn(async () => ["a"])
    expect(await loadSource(source(["TEST_SOURCE_TOKEN"], load), [])).toEqual([])
    expect(load).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("set TEST_SOURCE_TOKEN"))
  })

  it("falls back when the source fails, so the page still renders", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const failing = source([], async () => {
      throw new Error("HTTP 503")
    })
    expect(await loadSource(failing, ["fallback"])).toEqual(["fallback"])
    expect(warn).toHaveBeenCalledWith("[ticker] Test source failed:", "HTTP 503")
  })

  it("gives the source a signal that aborts after a few seconds", async () => {
    let signal: AbortSignal | undefined
    await loadSource(
      source([], async (s) => {
        signal = s
        return []
      }),
      [],
    )
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal!.aborted).toBe(false)
  })
})
