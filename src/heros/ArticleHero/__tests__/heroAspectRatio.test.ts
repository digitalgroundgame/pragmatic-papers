import { describe, expect, it } from "vitest"

import type { Media } from "@/payload-types"

import { heroAspectRatio, TALLEST_HERO, WIDEST_HERO } from "../heroAspectRatio"

const media = (width: number | null, height: number | null) =>
  ({ id: 1, alt: "", updatedAt: "", createdAt: "", width, height }) as Media

describe("heroAspectRatio", () => {
  it("keeps a wide banner's own shape, so it isn't cropped", () => {
    // The 1400×559 header that was cut off at the sides on "Liberalism and Moderation".
    expect(heroAspectRatio(media(1400, 559))).toBeCloseTo(1400 / 559)
  })

  it("keeps a 16:9 image's own shape", () => {
    expect(heroAspectRatio(media(1600, 900))).toBe(16 / 9)
  })

  it("crops anything taller than 16:9 to 16:9", () => {
    expect(heroAspectRatio(media(800, 1200))).toBe(TALLEST_HERO)
    expect(heroAspectRatio(media(800, 800))).toBe(TALLEST_HERO)
    expect(heroAspectRatio(media(1200, 900))).toBe(TALLEST_HERO)
  })

  it("crops anything wider than 4:1 to 4:1", () => {
    expect(heroAspectRatio(media(1920, 400))).toBe(WIDEST_HERO)
  })

  it("falls back to 16:9 without dimensions", () => {
    expect(heroAspectRatio(media(null, null))).toBe(TALLEST_HERO)
    expect(heroAspectRatio(media(1400, 0))).toBe(TALLEST_HERO)
    expect(heroAspectRatio(42)).toBe(TALLEST_HERO)
    expect(heroAspectRatio(null)).toBe(TALLEST_HERO)
    expect(heroAspectRatio(undefined)).toBe(TALLEST_HERO)
  })
})
