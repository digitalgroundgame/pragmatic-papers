import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Payload } from "payload"

import type { User } from "@/payload-types"

const { queryPublishedDocs } = vi.hoisted(() => ({ queryPublishedDocs: vi.fn() }))
vi.mock("../queries", () => ({ queryPublishedDocs }))

import { docsNotifications } from "../notifications"

const payload = {} as Payload
const user = (roles: User["roles"]) => ({ id: 1, roles }) as User

const docs = [
  { id: 1, slug: "everyone", title: "For all staff", summary: "a", publishedAt: "2026-10-18" },
  {
    id: 2,
    slug: "editors",
    title: "For editors",
    summary: "b",
    publishedAt: "2026-10-19",
    audience: ["editor"],
  },
]

beforeEach(() => {
  queryPublishedDocs.mockResolvedValue(docs)
})

const NOW = Date.parse("2026-10-20T12:00:00Z")
const BACKLOG = { launch: "2026-10-18", perWeek: 2 }

describe("docsNotifications", () => {
  const source = docsNotifications(BACKLOG, () => NOW)
  const titlesFor = async (roles: User["roles"]) =>
    (await source.itemsFor({ payload, user: user(roles) })).map((item) => item.title)

  it("links each doc and the /docs index", async () => {
    expect(source.index).toEqual({ label: "All docs", href: "/docs" })
    const [item] = await source.itemsFor({ payload, user: user(["writer"]) })
    expect(item).toEqual({
      id: "everyone",
      title: "For all staff",
      summary: "a",
      href: "/docs/everyone",
      date: "2026-10-18",
    })
  })

  it("shows a doc with an audience only to those roles, and to admins", async () => {
    expect(await titlesFor(["writer"])).toEqual(["For all staff"])
    expect(await titlesFor(["editor"])).toEqual(["For editors", "For all staff"])
    expect(await titlesFor(["chief-editor"])).toEqual(["For editors", "For all staff"])
  })

  it("announces older docs a batch a week from launch, newest feature first", async () => {
    const backdated = (slug: string, publishedAt: string) => ({
      id: slug,
      slug,
      title: slug,
      summary: "",
      publishedAt,
    })
    queryPublishedDocs.mockResolvedValue([
      ...docs,
      backdated("oldest", "2025-01-01"),
      backdated("newer", "2026-03-01"),
      backdated("newest", "2026-06-01"),
    ])
    const items = (now: string) =>
      docsNotifications(BACKLOG, () => Date.parse(now)).itemsFor({
        payload,
        user: user(["editor"]),
      })

    // Launch week: the two newest backlog docs, dated the launch, below the newer docs.
    expect((await items("2026-10-20")).map(({ id, date }) => [id, date.slice(0, 10)])).toEqual([
      ["editors", "2026-10-19"],
      ["everyone", "2026-10-18"],
      ["newest", "2026-10-18"],
      ["newer", "2026-10-18"],
    ])
    // Before launch, none of them.
    expect((await items("2026-10-17")).map(({ id }) => id)).toEqual(["editors", "everyone"])
    // A week on, the next batch.
    expect((await items("2026-10-25"))[0]).toMatchObject({
      id: "oldest",
      date: "2026-10-25T00:00:00.000Z",
    })
  })

  it("shows nothing to readers, without querying", async () => {
    expect(await titlesFor(["member"])).toEqual([])
    expect(await titlesFor([])).toEqual([])
    expect(queryPublishedDocs).not.toHaveBeenCalled()
  })
})
