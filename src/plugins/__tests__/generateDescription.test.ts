import type { Article, Page, Topic, Volume } from "@/payload-types"
import { DEFAULT_DESCRIPTION } from "@/utilities/mergeOpenGraph"
import { describe, expect, it } from "vitest"
import { generateDescription } from "../index"

type Args = Parameters<typeof generateDescription>[0]
type Doc = Volume | Article | Page | Topic

const describeDoc = (doc: Partial<Doc>) => generateDescription({ doc } as Args)

describe("generateDescription", () => {
  it.each([
    ["a topic", { name: "Economics", description: "Markets, money and work." }],
    ["a volume", { volumeNumber: 3, description: "Our third volume." }],
  ])("uses the description of %s", async (_, doc) => {
    expect(await describeDoc(doc as Partial<Doc>)).toBe(doc.description)
  })

  it.each([
    ["an article", { title: "On Pragmatism", slug: "on-pragmatism" }],
    ["a topic with no description", { name: "Economics", description: null }],
    ["an empty doc", {}],
  ])("offers the site default description for %s", async (_, doc) => {
    expect(await describeDoc(doc as Partial<Doc>)).toBe(DEFAULT_DESCRIPTION)
  })
})
