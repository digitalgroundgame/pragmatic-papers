import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Payload } from "payload"

import type { User } from "@/payload-types"

const { queryPublishedDocs } = vi.hoisted(() => ({ queryPublishedDocs: vi.fn() }))
vi.mock("../queries", () => ({ queryPublishedDocs }))

import { docsNotifications } from "../notifications"
import { docThumbnail } from "../thumbnail"

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
  {
    id: 1,
    slug: "everyone",
    title: "For all staff",
    summary: "a",
    publishedAt: "2026-10-18",
    heroImage: {
      id: 7,
      alt: "The bell",
      url: "/api/media/file/bell.png",
      sizes: { thumbnail: { url: "/api/media/file/bell-300x158.webp" } },
    },
  },
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
      image: { url: "/api/media/file/bell-300x158.webp", alt: "The bell" },
    })
  })

  it("falls back to the hero image itself where it has no thumbnail size, and to none", async () => {
    expect(docThumbnail({ id: 7, alt: null, url: "/api/media/file/bell.svg" } as never)).toEqual({
      url: "/api/media/file/bell.svg",
      alt: "",
    })
    expect(docThumbnail(7)).toBeUndefined()
    expect(docThumbnail(null)).toBeUndefined()
  })

  it("shows a doc with an audience only to those roles, and to admins", async () => {
    expect(await titlesFor(["writer"])).toEqual(["For all staff"])
    expect(await titlesFor(["editor"])).toEqual(["For editors", "For all staff"])
    expect(await titlesFor(["chief-editor"])).toEqual(["For editors", "For all staff"])
  })

  it("offers a doc's tour as Show me, and leaves out a tour that doesn't exist", async () => {
    queryPublishedDocs.mockResolvedValue([
      { ...docs[1], tour: "articles" },
      { ...docs[1], id: 3, slug: "gone", tour: "no-such-tour" },
    ])
    const [withTour, missing] = await source.itemsFor({ payload, user: user(["writer"]) })
    expect(withTour).toMatchObject({ href: "/docs/everyone", showMe: "/admin?tour=articles" })
    expect(missing).not.toHaveProperty("showMe")
  })

  it("shows nothing to readers, without querying", async () => {
    expect(await titlesFor(["member"])).toEqual([])
    expect(await titlesFor([])).toEqual([])
    expect(queryPublishedDocs).not.toHaveBeenCalled()
  })
})
