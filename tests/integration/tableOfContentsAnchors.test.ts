import { beforeAll, describe, expect, it } from "vitest"
import type { Payload } from "payload"
import type { Article } from "@/payload-types"
import { createUser, getPayload } from "./helpers/testUsers"

interface Node {
  type: string
  anchor?: string
  children?: Node[]
}

function heading(tag: string, text: string, anchor?: string) {
  return {
    type: "heading",
    tag,
    ...(anchor && { anchor }),
    children: [{ type: "text", text, version: 1 }],
    direction: null,
    format: "",
    indent: 0,
    version: 1,
  }
}

const table = {
  type: "table",
  children: [
    {
      type: "tablerow",
      children: [
        {
          type: "tablecell",
          headerState: 0,
          children: [{ type: "paragraph", children: [], version: 1 }],
          version: 1,
        },
      ],
      version: 1,
    },
  ],
  version: 1,
}

function content(children: object[]) {
  return { root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 } }
}

function anchorsOf(article: Article): (string | undefined)[] {
  return (article.content.root.children as Node[]).map((node) => node.anchor)
}

describe("table of contents anchors", () => {
  let payload: Payload
  const context = { disableRevalidate: true }

  beforeAll(async () => {
    payload = await getPayload()
  })

  it("stamps heading and table anchors when an article is saved", async () => {
    const created = await payload.create({
      collection: "articles",
      overrideAccess: true,
      context,
      data: {
        title: "TOC Anchors: Create",
        content: content([heading("h2", "Overview"), table, heading("h3", "Overview")]),
        _status: "draft",
      } as unknown as Article,
    })

    const stored = await payload.findByID({
      collection: "articles",
      id: created.id,
      draft: true,
      overrideAccess: true,
    })
    expect(anchorsOf(stored)).toEqual(["overview", "table-1", "overview-2"])
  })

  it("re-stamps anchors on a writer's autosave of their own draft", async () => {
    const writer = await createUser("writer")
    const draft = await payload.create({
      collection: "articles",
      overrideAccess: false,
      user: writer,
      draft: true,
      context,
      data: {
        title: "TOC Anchors: Writer Autosave",
        content: content([heading("h2", "Draft heading")]),
        _status: "draft",
      } as unknown as Article,
    })
    expect(anchorsOf(draft)).toEqual(["draft-heading"])

    const autosaved = await payload.update({
      collection: "articles",
      id: draft.id,
      overrideAccess: false,
      user: writer,
      draft: true,
      autosave: true,
      context,
      data: {
        content: content([heading("h2", "Renamed heading", "draft-heading")]),
      } as unknown as Article,
    })
    expect(anchorsOf(autosaved)).toEqual(["renamed-heading"])
  })
})
