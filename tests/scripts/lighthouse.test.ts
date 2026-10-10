import { describe, expect, it } from "vitest"

import {
  cpuMultiplier,
  formatRange,
  formatValue,
  median,
  metricsOf,
  regressed,
  regressions,
  renderReport,
  renderSummary,
  type PageResult,
  type Samples,
  type Summary,
} from "../../scripts/lighthouse"

const samples = (overrides: Partial<Samples> = {}): Samples => ({
  score: [90, 91, 89],
  fcp: [1200, 1180, 1220],
  lcp: [2000, 1950, 2100],
  tbt: [150, 140, 170],
  cls: [0.01, 0.01, 0.01],
  speedIndex: [1800, 1790, 1850],
  totalBytes: [800 * 1024, 800 * 1024, 800 * 1024],
  scriptBytes: [500 * 1024, 500 * 1024, 500 * 1024],
  ...overrides,
})

const page = (pr: Partial<Samples> = {}, dev: Partial<Samples> | null = {}): PageResult => ({
  name: "Home",
  path: "/",
  pr: samples(pr),
  dev: dev === null ? null : samples(dev),
})

const summary = (pages: PageResult[]): Summary => ({
  runs: 3,
  benchmarkIndex: 2100,
  cpuSlowdownMultiplier: 4.2,
  pages,
})

describe("metricsOf", () => {
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
    expect(metricsOf(lhr as never)).toEqual({
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

describe("median", () => {
  it("takes the middle value, or the mean of the middle two, ignoring NaN", () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([Number.NaN, 5])).toBe(5)
    expect(median([])).toBeNaN()
  })
})

describe("cpuMultiplier", () => {
  it("scales Lighthouse's 4× with the benchmark index", () => {
    expect(cpuMultiplier(2000)).toBe(4)
    expect(cpuMultiplier(3000)).toBe(6)
    expect(cpuMultiplier(1234)).toBe(2.5)
  })

  it("stays within 1× and 20×, and falls back to 4× without a benchmark", () => {
    expect(cpuMultiplier(100)).toBe(1)
    expect(cpuMultiplier(50_000)).toBe(20)
    expect(cpuMultiplier(Number.NaN)).toBe(4)
    expect(cpuMultiplier(0)).toBe(4)
  })
})

describe("regressed", () => {
  it("needs every run worse than every dev run", () => {
    // Medians 600 ms apart, but one PR run is as fast as a dev run.
    expect(regressed("lcp", [2000, 2100, 2200], [2150, 2700, 2800])).toBe(false)
    expect(regressed("lcp", [2000, 2100, 2200], [2600, 2700, 2800])).toBe(true)
  })

  it("needs the medians further apart than the threshold", () => {
    // Separated, but only by 20 ms.
    expect(regressed("tbt", [100, 101, 102], [120, 121, 122])).toBe(false)
    expect(regressed("tbt", [100, 101, 102], [300, 301, 302])).toBe(true)
  })

  it("treats a lower score as worse", () => {
    expect(regressed("score", [90, 91, 92], [80, 81, 82])).toBe(true)
    expect(regressed("score", [80, 81, 82], [90, 91, 92])).toBe(false)
    expect(regressed("score", [90, 91, 92], [85, 86, 91])).toBe(false)
  })

  it("never flags an improvement, or a side with no runs", () => {
    expect(regressed("tbt", [900, 950], [100, 120])).toBe(false)
    expect(regressed("tbt", [], [100])).toBe(false)
  })

  it("flags a byte count past its threshold, since those don't vary", () => {
    expect(regressed("scriptBytes", [500_000], [520_000])).toBe(true)
    expect(regressed("scriptBytes", [500_000], [501_000])).toBe(false)
  })
})

describe("regressions", () => {
  it("lists the metrics that got worse, and none without dev", () => {
    expect(regressions(page({ lcp: [3000, 3100, 3200], cls: [0.2, 0.2, 0.2] }))).toEqual([
      "lcp",
      "cls",
    ])
    expect(regressions(page({ lcp: [3000, 3100, 3200] }, null))).toEqual([])
  })
})

describe("formatValue and formatRange", () => {
  it("formats each kind of metric", () => {
    expect(formatValue("score", 87.4)).toBe("87")
    expect(formatValue("lcp", 950)).toBe("950 ms")
    expect(formatValue("lcp", 2450)).toBe("2.5 s")
    expect(formatValue("cls", 0.1234)).toBe("0.123")
    expect(formatValue("scriptBytes", 512 * 1024)).toBe("512 kB")
    expect(formatValue("fcp", Number.NaN)).toBe("n/a")
  })

  it("collapses a range whose ends look the same", () => {
    expect(formatRange("tbt", [140, 170, 150])).toBe("140 ms–170 ms")
    expect(formatRange("scriptBytes", [512 * 1024, 512 * 1024])).toBe("512 kB")
    expect(formatRange("tbt", [])).toBe("n/a")
  })
})

describe("renderReport", () => {
  it("says when there were no dev results to compare with", () => {
    const report = renderReport(summary([page({}, null)]))
    expect(report).toContain("No results from `dev` to compare with yet")
    expect(report).toContain("| Home | 90 | 2.0 s | 150 ms | 0.010 | 1.2 s | 500 kB | 800 kB |")
    expect(report).not.toContain("| | dev |")
  })

  it("shows changes against dev's medians and flags regressions", () => {
    const report = renderReport(summary([page({ lcp: [3000, 3100, 3200], tbt: [155, 160, 165] })]))
    expect(report).toContain("⚠️ 1 page is much slower than on `dev` in every one of 3 runs.")
    expect(report).toContain("⚠️ **3.1 s** (+1.1 s)")
    expect(report).toContain("| 160 ms (+10 ms) |")
    expect(report).toContain("| Home | this PR | 89–91 | 3.0 s–3.2 s |")
    expect(report).toContain("| | dev | 89–91 | 1.9 s–2.1 s |")
  })

  it("stays quiet when the runs overlap", () => {
    const report = renderReport(summary([page({ tbt: [140, 200, 260] })]))
    expect(report).toContain("No page is much slower than on `dev`")
    expect(report).not.toContain("⚠️")
  })

  it("says how many pages dev's results don't have", () => {
    const report = renderReport(summary([page(), { ...page(), path: "/new", dev: null }]))
    expect(report).toContain("Dev's results don't have 1 of the pages")
  })

  it("states the CPU calibration", () => {
    expect(renderReport(summary([page()]))).toContain(
      "CPU 4.2× slower, from a benchmark index of 2100",
    )
  })
})

describe("renderSummary", () => {
  it("names the regressions, with the home page's score", () => {
    expect(renderSummary(summary([page({ lcp: [3000, 3100, 3200] })]))).toBe(
      "⚠️ 1 page is much slower than on dev, Home scores 90",
    )
  })

  it("says when nothing regressed, or there was nothing to compare with", () => {
    expect(renderSummary(summary([page()]))).toBe(
      "no page is much slower than on dev, Home scores 90",
    )
    expect(renderSummary(summary([page({}, null)]))).toBe(
      "no results from dev to compare with yet, Home scores 90",
    )
  })

  it("leaves the score out when the home page wasn't measured", () => {
    expect(renderSummary(summary([{ ...page(), path: "/volumes/1" }]))).toBe(
      "no page is much slower than on dev",
    )
  })
})
