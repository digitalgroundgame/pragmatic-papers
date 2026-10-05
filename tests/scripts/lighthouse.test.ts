import { describe, expect, it } from "vitest"

import {
  formatValue,
  regressed,
  regressions,
  renderReport,
  summarize,
  type PageResult,
} from "../../scripts/lighthouse"

const page = (overrides: Partial<PageResult> = {}): PageResult => ({
  name: "Home",
  path: "/",
  score: 90,
  fcp: 1200,
  lcp: 2000,
  tbt: 150,
  cls: 0.01,
  speedIndex: 1800,
  totalBytes: 800 * 1024,
  scriptBytes: 500 * 1024,
  ...overrides,
})

describe("summarize", () => {
  it("reads the metrics from a Lighthouse result", () => {
    const audit = (numericValue: number) => ({ numericValue })
    const lhr = {
      categories: { performance: { score: 0.876 } },
      audits: {
        "first-contentful-paint": audit(1100),
        "largest-contentful-paint": audit(2500),
        "total-blocking-time": audit(300),
        "cumulative-layout-shift": audit(0.02),
        "speed-index": audit(1900),
        "total-byte-weight": audit(900_000),
        "resource-summary": {
          details: {
            items: [
              { resourceType: "total", transferSize: 900_000 },
              { resourceType: "script", transferSize: 512_000 },
            ],
          },
        },
      },
    }
    expect(summarize("Home", "/", lhr as never)).toEqual({
      name: "Home",
      path: "/",
      score: 88,
      fcp: 1100,
      lcp: 2500,
      tbt: 300,
      cls: 0.02,
      speedIndex: 1900,
      totalBytes: 900_000,
      scriptBytes: 512_000,
    })
  })
})

describe("regressed", () => {
  it("needs a change past both the relative and the absolute floor", () => {
    // +25% but only 50 ms.
    expect(regressed("lcp", 200, 250)).toBe(false)
    // +600 ms but only 10%.
    expect(regressed("lcp", 6000, 6600)).toBe(false)
    expect(regressed("lcp", 2000, 2600)).toBe(true)
  })

  it("treats a lower score as worse", () => {
    expect(regressed("score", 90, 81)).toBe(false)
    expect(regressed("score", 90, 79)).toBe(true)
    expect(regressed("score", 70, 95)).toBe(false)
  })

  it("never flags an improvement", () => {
    expect(regressed("tbt", 900, 100)).toBe(false)
  })
})

describe("regressions", () => {
  it("lists the metrics that got worse, and none without a baseline", () => {
    const after = page({ lcp: 3000, cls: 0.2 })
    expect(regressions(after, page())).toEqual(["lcp", "cls"])
    expect(regressions(after, undefined)).toEqual([])
  })
})

describe("formatValue", () => {
  it("formats each kind of metric", () => {
    expect(formatValue("score", 87.4)).toBe("87")
    expect(formatValue("lcp", 950)).toBe("950 ms")
    expect(formatValue("lcp", 2450)).toBe("2.5 s")
    expect(formatValue("cls", 0.1234)).toBe("0.123")
    expect(formatValue("scriptBytes", 512 * 1024)).toBe("512 kB")
    expect(formatValue("fcp", Number.NaN)).toBe("n/a")
  })
})

describe("renderReport", () => {
  it("says when there's nothing to compare with", () => {
    const report = renderReport({ results: [page()], base: null, runs: 3 })
    expect(report).toContain("No results from `dev` to compare with yet.")
    expect(report).toContain("| Home | 90 | 2.0 s | 150 ms | 0.010 | 1.2 s | 500 kB | 800 kB |")
  })

  it("shows changes and flags regressions", () => {
    const report = renderReport({
      results: [page({ lcp: 3000, tbt: 160 })],
      base: [page()],
      runs: 3,
    })
    expect(report).toContain("⚠️ 1 page looks slower than on `dev`.")
    expect(report).toContain("⚠️ **3.0 s** (+1.0 s)")
    expect(report).toContain("| 160 ms (+10 ms) |")
  })

  it("stays quiet when nothing moved past the thresholds", () => {
    const report = renderReport({ results: [page()], base: [page()], runs: 3 })
    expect(report).toContain("No page moved past the noise thresholds")
    expect(report).not.toContain("⚠️")
  })
})
