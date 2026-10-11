import type { Article, Interactive, Page, Topic, Volume } from "@/payload-types"
import { DEFAULT_DESCRIPTION } from "@/utilities/mergeOpenGraph"
import { describe, expect, it } from "vitest"
import { generateDescription } from "../index"

type Args = Parameters<typeof generateDescription>[0]
type Doc = Volume | Article | Page | Topic | Interactive

const intro = (...texts: string[]) => ({
  root: {
    type: "root",
    children: texts.map((text) => ({ type: "paragraph", children: [{ type: "text", text }] })),
  },
})

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

  it("uses an interactive's intro", async () => {
    const doc = { title: "Courts", intro: intro("Who sits on every federal bench.") }
    expect(await describeDoc(doc as unknown as Partial<Doc>)).toBe(
      "Who sits on every federal bench.",
    )
  })

  it("cuts a long intro at a word boundary", async () => {
    const long = "Who sits on every federal bench, and who put them there. ".repeat(5)
    const description = await describeDoc({ intro: intro(long) } as unknown as Partial<Doc>)
    expect(description.length).toBeLessThanOrEqual(160)
    expect(description).toMatch(/\w…$/)
    expect(long.startsWith(description.slice(0, -1))).toBe(true)
  })

  it("offers the site default for an interactive with an empty intro", async () => {
    expect(await describeDoc({ intro: intro("  ") } as unknown as Partial<Doc>)).toBe(
      DEFAULT_DESCRIPTION,
    )
  })
})
