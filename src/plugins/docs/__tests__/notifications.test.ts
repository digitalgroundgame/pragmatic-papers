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
  { id: 3, slug: "home", title: "Docs home", summary: "c", publishedAt: "2026-10-20" },
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
  it("leaves out the docs' home page", async () => {
    const items = await docsNotifications().itemsFor({ payload, user: user(["admin"]) })
    expect(items.map((item) => item.id)).not.toContain("home")
  })

  it("leaves out the docs others sit under, and links each doc at its place in the tree", async () => {
    queryPublishedDocs.mockResolvedValue([
      { id: 10, slug: "writing", title: "Writing", summary: "w", publishedAt: "2026-10-25" },
      {
        id: 11,
        slug: "footnotes",
        title: "Footnotes",
        summary: "f",
        publishedAt: "2026-10-24",
        parent: 10,
      },
    ])
    const items = await docsNotifications().itemsFor({ payload, user: user(["writer"]) })
    expect(items.map((item) => [item.id, item.href])).toEqual([
      ["footnotes", "/docs/writing/footnotes"],
    ])
  })

  const source = docsNotifications()
  const titlesFor = async (roles: User["roles"]) =>
    (await source.itemsFor({ payload, user: user(roles) })).map((item) => item.title)

  it("links each doc and What's new", async () => {
    expect(source.index).toEqual({ label: "See all", href: "/docs/whats-new" })
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

  it("gives a doc without an audience the one its area or section has", async () => {
    queryPublishedDocs.mockResolvedValue([
      {
        id: 10,
        slug: "editing",
        title: "Editing",
        summary: "e",
        publishedAt: "2026-10-25",
        audience: ["editor"],
      },
      {
        id: 11,
        slug: "ticker",
        title: "Ticker",
        summary: "t",
        publishedAt: "2026-10-24",
        parent: 10,
      },
    ])
    expect(await titlesFor(["writer"])).toEqual([])
    expect(await titlesFor(["editor"])).toEqual(["Ticker"])
  })

  it("offers a doc's tour as Show me, and leaves out a tour that doesn't exist", async () => {
    queryPublishedDocs.mockResolvedValue([
      { ...docs[2], tour: "articles" },
      { ...docs[2], id: 4, slug: "gone", tour: "no-such-tour" },
    ])
    const [withTour, missing] = await source.itemsFor({ payload, user: user(["writer"]) })
    expect(withTour).toMatchObject({ href: "/docs/everyone", showMe: "/admin?tour=articles" })
    expect(missing).not.toHaveProperty("showMe")
  })

  it("leaves out Show me while tours are off", async () => {
    queryPublishedDocs.mockResolvedValue([{ ...docs[2], tour: "articles" }])
    const tours = vi.fn(async () => false)
    const [item] = await docsNotifications({ tours }).itemsFor({ payload, user: user(["writer"]) })
    expect(item).not.toHaveProperty("showMe")
    expect(tours).toHaveBeenCalledWith(payload)
  })

  it("hands the bell its docs switch, so the bell leaves the source out while it's off", () => {
    const enabled = vi.fn(async () => false)
    expect(docsNotifications({ enabled }).enabled).toBe(enabled)
    expect(docsNotifications().enabled).toBeUndefined()
  })

  it("shows nothing to readers, without querying", async () => {
    expect(await titlesFor(["member"])).toEqual([])
    expect(await titlesFor([])).toEqual([])
    expect(queryPublishedDocs).not.toHaveBeenCalled()
  })
})
