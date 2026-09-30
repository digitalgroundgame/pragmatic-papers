// @vitest-environment node
import { hasRemoteMatch } from "next/dist/shared/lib/match-remote-pattern"
import { describe, expect, it } from "vitest"

import nextConfig from "../../next.config"

// images.remotePatterns is fixed when the image builds, so production's media host has to
// be allowed without knowing it then (#1090). These are the URLs generateFileURL
// (src/plugins/index.ts) gives media with S3 storage.
const allowed = (url: string): boolean =>
  hasRemoteMatch([], nextConfig.images?.remotePatterns ?? [], new URL(url))

describe("next/image remote patterns", () => {
  it("load media from any Supabase project's public bucket", () => {
    expect(allowed("https://abcdefgh.supabase.co/storage/v1/object/public/media/hero.webp")).toBe(
      true,
    )
    expect(
      allowed(
        "https://zyxwvuts.supabase.co/storage/v1/object/public/media/hero-1200x630.webp?2026-09-30T12%3A00%3A00.000Z",
      ),
    ).toBe(true)
  })

  it("don't load a Supabase project's other paths, or plain http", () => {
    expect(allowed("https://abcdefgh.supabase.co/storage/v1/object/sign/media/hero.webp")).toBe(
      false,
    )
    expect(allowed("http://abcdefgh.supabase.co/storage/v1/object/public/media/hero.webp")).toBe(
      false,
    )
  })

  it("don't load other hosts that end in supabase.co", () => {
    expect(allowed("https://evilsupabase.co/storage/v1/object/public/media/hero.webp")).toBe(false)
  })
})
