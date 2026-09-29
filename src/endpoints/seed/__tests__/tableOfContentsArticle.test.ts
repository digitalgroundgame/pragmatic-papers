import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { stampTableOfContentsAnchors, tableOfContentsEntries } from "@/components/TableOfContents"
import type { TableOfContentsEntry } from "@/components/TableOfContents/types"
import type { Media, User } from "@/payload-types"

import { createTableOfContentsArticle } from "../features/table-of-contents"

const writer = { id: 1, roles: ["writer"] } as User
const media = [1, 2, 3, 4].map((id) => ({ id }) as Media)

// Seeds that download their own images get a stand-in.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array([1]))),
  )
  return () => vi.unstubAllGlobals()
})

/** The tour's content, stamped the way the save hook stamps it. */
async function tourEntries(): Promise<TableOfContentsEntry[]> {
  let content: DefaultTypedEditorState | undefined
  let nextId = 100
  const create = vi.fn(async ({ collection, data }: { collection: string; data: never }) => {
    if (collection === "articles") content = (data as { content: DefaultTypedEditorState }).content
    return { id: nextId++ }
  })
  const payload = { create, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as never
  await createTableOfContentsArticle(payload, [writer], media)
  return tableOfContentsEntries(stampTableOfContentsAnchors(content!))
}

const labels = (entries: TableOfContentsEntry[] | undefined) => entries?.map((e) => e.label)

describe("the table of contents tour article", () => {
  it("nests each listed block under its section, not under the table's heading", async () => {
    const blocks = (await tourEntries()).find((e) => e.label === "Blocks that earn an entry")
    expect(labels(blocks?.children)).toEqual([
      "Missouri's 120th Congress margins",
      "An article's path to publication",
      "Image grid",
      "Carousel",
      "YouTube embed",
      "How each block is listed",
      "In practice",
    ])
  })

  it("folds the table into the heading right above it", async () => {
    const blocks = (await tourEntries()).find((e) => e.label === "Blocks that earn an entry")
    const tableHeading = blocks?.children?.find((e) => e.label === "How each block is listed")
    expect(tableHeading?.icon).toBeDefined()
    expect(tableHeading?.children ?? []).toEqual([])
  })
})
