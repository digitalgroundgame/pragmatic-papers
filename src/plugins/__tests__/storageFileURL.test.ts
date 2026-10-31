import { afterEach, describe, expect, it, vi } from "vitest"
import { storageFileURL } from "../index"

// Production stores uploads in Supabase; staging and previews use local storage, so
// nothing but this test exercises the Supabase branch before a release.
describe("storageFileURL", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const supabase = () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("S3_BUCKET", "uploads")
  }

  it("points media at its Supabase object, in the folder the storage plugin passes", () => {
    supabase()
    expect(storageFileURL("media")({ filename: "photo.webp", prefix: "abc123" })).toBe(
      "https://project.supabase.co/storage/v1/object/public/uploads/abc123/photo.webp",
    )
  })

  it("puts media with no folder at the bucket's root", () => {
    supabase()
    expect(storageFileURL("media")({ filename: "photo.webp" })).toBe(
      "https://project.supabase.co/storage/v1/object/public/uploads/photo.webp",
    )
  })

  it("files a map asset with no folder under its collection prefix", () => {
    supabase()
    const url = storageFileURL("map-assets", "map-assets")
    expect(url({ filename: "states.svg", prefix: "" })).toBe(
      "https://project.supabase.co/storage/v1/object/public/uploads/map-assets/states.svg",
    )
    expect(url({ filename: "states.svg", prefix: "map-assets/xyz" })).toBe(
      "https://project.supabase.co/storage/v1/object/public/uploads/map-assets/xyz/states.svg",
    )
  })

  it.each([
    ["SUPABASE_URL", { S3_BUCKET: "uploads" }],
    ["S3_BUCKET", { SUPABASE_URL: "https://project.supabase.co" }],
  ])("falls back to the local path without %s", (_missing, env) => {
    vi.stubEnv("SUPABASE_URL", "")
    vi.stubEnv("S3_BUCKET", "")
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)

    expect(storageFileURL("media")({ filename: "photo.webp", prefix: "abc123" })).toBe(
      "/media/photo.webp",
    )
    expect(storageFileURL("map-assets", "map-assets")({ filename: "states.svg" })).toBe(
      "/map-assets/states.svg",
    )
  })
})
