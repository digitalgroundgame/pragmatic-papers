import { describe, expect, it } from "vitest"
import { supabaseObjectURL } from "../index"

const base = { supabaseUrl: "https://abcdefgh.supabase.co", bucket: "media" }

describe("supabaseObjectURL", () => {
  it("puts media uploaded before _objectKey at the bucket's root", () => {
    expect(supabaseObjectURL({ ...base, prefix: "", filename: "hero.webp" })).toBe(
      "https://abcdefgh.supabase.co/storage/v1/object/public/media/hero.webp",
    )
    expect(supabaseObjectURL({ ...base, filename: "hero.webp" })).toBe(
      "https://abcdefgh.supabase.co/storage/v1/object/public/media/hero.webp",
    )
  })

  it("includes the _objectKey folder a client upload is stored under", () => {
    expect(
      supabaseObjectURL({
        ...base,
        prefix: "5b0c1f2e-9d1a-4c47-8a51-0f6b3f1d2c3e",
        filename: "hero-1200x630.webp",
      }),
    ).toBe(
      "https://abcdefgh.supabase.co/storage/v1/object/public/media/5b0c1f2e-9d1a-4c47-8a51-0f6b3f1d2c3e/hero-1200x630.webp",
    )
  })

  it("keeps a collection prefix ahead of the _objectKey folder", () => {
    expect(
      supabaseObjectURL({ ...base, prefix: "map-assets/5b0c1f2e", filename: "districts.svg" }),
    ).toBe(
      "https://abcdefgh.supabase.co/storage/v1/object/public/media/map-assets/5b0c1f2e/districts.svg",
    )
  })
})
