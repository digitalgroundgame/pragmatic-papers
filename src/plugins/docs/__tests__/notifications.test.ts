import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Payload } from "payload"

import type { User } from "@/payload-types"

const { queryPublishedDocs } = vi.hoisted(() => ({ queryPublishedDocs: vi.fn() }))
vi.mock("../queries", () => ({ queryPublishedDocs }))

import { docsNotifications } from "../notifications"

const payload = {} as Payload
const user = (roles: User["roles"]) => ({ id: 1, roles }) as User

// Newest first, as queryPublishedDocs returns them.
const docs = [
  {
    id: 2,
    slug: "editors",
    title: "For editors",
    summary: "b",
    publishedAt: "2026-10-19",
    audience: ["editor"],
  },
  { id: 1, slug: "everyone", title: "For all staff", summary: "a", publishedAt: "2026-10-18" },
]

beforeEach(() => {
  queryPublishedDocs.mockResolvedValue(docs)
})

describe("docsNotifications", () => {
  const source = docsNotifications()
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

  it("shows nothing to readers, without querying", async () => {
    expect(await titlesFor(["member"])).toEqual([])
    expect(await titlesFor([])).toEqual([])
    expect(queryPublishedDocs).not.toHaveBeenCalled()
  })
})
