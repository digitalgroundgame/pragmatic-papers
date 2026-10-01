// @vitest-environment node
import type { Article } from "@/payload-types"
import { describe, expect, it } from "vitest"

import { populateMetaImageFromHero } from "../populateMetaImageFromHero"

const run = (data: Partial<Article>) =>
  populateMetaImageFromHero({ data } as never) as Partial<Article>

describe("populateMetaImageFromHero", () => {
  it("uses the hero image when there's no meta image", () => {
    expect(run({ heroImage: 4 }).meta).toEqual({ image: 4 })
  })

  it("keeps the other meta fields when filling the image", () => {
    const result = run({ heroImage: 4, meta: { title: "T", description: "D", image: null } })

    expect(result.meta).toEqual({ title: "T", description: "D", image: 4 })
  })

  it("doesn't overwrite a meta image that's already set", () => {
    expect(run({ heroImage: 4, meta: { image: 9 } }).meta).toEqual({ image: 9 })
  })

  it("does nothing without a hero image", () => {
    expect(run({ meta: { title: "T" } }).meta).toEqual({ title: "T" })
    expect(run({}).meta).toBeUndefined()
  })
})
