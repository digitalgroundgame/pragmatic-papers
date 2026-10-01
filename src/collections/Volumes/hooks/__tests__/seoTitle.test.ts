// @vitest-environment node
import type { Volume } from "@/payload-types"
import { describe, expect, it } from "vitest"

import { setDefaultSeoTitle } from "../seoTitle"

const run = (data: Partial<Volume>) => setDefaultSeoTitle({ data } as never) as Partial<Volume>

describe("setDefaultSeoTitle", () => {
  it("fills an empty meta title with the volume's Roman numeral", () => {
    expect(run({ volumeNumber: 14, meta: {} }).meta?.title).toBe(
      "Volume XIV | The Pragmatic Papers",
    )
  })

  it("keeps a meta title an editor wrote", () => {
    expect(run({ volumeNumber: 3, meta: { title: "Custom" } }).meta?.title).toBe("Custom")
  })

  it("does nothing without a volume number or a meta group", () => {
    expect(run({ meta: {} }).meta?.title).toBeUndefined()
    expect(run({ volumeNumber: 3 }).meta).toBeUndefined()
  })
})
