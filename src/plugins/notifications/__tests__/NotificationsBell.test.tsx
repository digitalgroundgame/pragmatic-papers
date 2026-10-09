import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type { Payload, ServerProps } from "payload"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { setPreference } = vi.hoisted(() => ({ setPreference: vi.fn() }))
vi.mock("@payloadcms/ui", () => ({ usePreferences: () => ({ setPreference }) }))

import { NotificationsBell } from "../NotificationsBell"
import type { NotificationSource } from "../types"

const user = { id: 7, collection: "users", createdAt: "2026-01-01T00:00:00.000Z", roles: [] }

const source = (slug: string, titles: string[], index = true): NotificationSource => ({
  type: { slug, label: slug === "docs" ? "Docs" : "Published", description: `${slug} things` },
  ...(index ? { index: { label: `All ${slug}`, href: `/${slug}` } } : {}),
  itemsFor: vi.fn(async () =>
    titles.map((title, i) => ({
      id: `${slug}-${i}`,
      title,
      href: `/${slug}/${i}`,
      date: `2026-10-${String(18 - i).padStart(2, "0")}`,
    })),
  ),
})

const fakePayload = (sources: NotificationSource[], preference?: unknown) => {
  const find = vi.fn(async () => ({ docs: preference ? [{ value: preference }] : [] }))
  const payload = {
    config: { custom: { notifications: { sources } } },
    find,
    logger: { error: vi.fn() },
  } as unknown as Payload
  return { payload, find }
}

const renderBell = async (payload: Payload, withUser = true) => {
  const node = await NotificationsBell({
    payload,
    user: withUser ? user : undefined,
  } as unknown as ServerProps)
  return render(node as React.ReactElement)
}

const openMenu = () => fireEvent.click(screen.getByRole("button", { name: /^Notifications/ }))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe("NotificationsBell", () => {
  it("renders nothing without a user or without sources", async () => {
    const { payload } = fakePayload([source("docs", ["Alpha"])])
    expect(await NotificationsBell({ payload } as unknown as ServerProps)).toBeNull()
    const empty = fakePayload([]).payload
    expect(await NotificationsBell({ payload: empty, user } as unknown as ServerProps)).toBeNull()
  })

  it("counts what the user hasn't read, from their saved preference", async () => {
    const docs = source("docs", ["Alpha", "Beta", "Gamma"])
    const { payload, find } = fakePayload([docs], { read: ["docs:docs-0"], muted: [] })
    await renderBell(payload)
    expect(docs.itemsFor).toHaveBeenCalledWith({ payload, user })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "payload-preferences",
        where: {
          and: [
            { key: { equals: "notifications" } },
            { "user.relationTo": { equals: "users" } },
            { "user.value": { equals: 7 } },
          ],
        },
      }),
    )
    expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toBeInTheDocument()
  })

  it("shows at most eight of each type", async () => {
    const titles = Array.from({ length: 12 }, (_, i) => `Doc ${i}`)
    await renderBell(fakePayload([source("docs", titles)]).payload)
    openMenu()
    expect(await screen.findAllByRole("listitem")).toHaveLength(8)
  })

  it("leaves out a source that fails, and logs it", async () => {
    const broken = source("published", [])
    vi.mocked(broken.itemsFor).mockRejectedValue(new Error("boom"))
    const { payload } = fakePayload([source("docs", ["Alpha"]), broken])
    await renderBell(payload)
    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ type: "published" }),
      "A notification source failed",
    )
    expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeInTheDocument()
  })

  it("leaves a muted type's items and index link out", async () => {
    const { payload } = fakePayload(
      [source("docs", ["Alpha"]), source("published", ["Published one"])],
      {
        read: [],
        muted: ["published"],
      },
    )
    await renderBell(payload)
    openMenu()
    const menu = await screen.findByRole("dialog")
    expect(within(menu).getByRole("link", { name: /^Alpha/ })).toBeInTheDocument()
    expect(within(menu).queryByRole("link", { name: /^Published one/ })).not.toBeInTheDocument()
    expect(within(menu).queryByRole("link", { name: "All published" })).not.toBeInTheDocument()
    expect(within(menu).getByRole("link", { name: "All docs" })).toBeInTheDocument()
  })

  it("saves an opened item as read", async () => {
    await renderBell(fakePayload([source("docs", ["Alpha", "Beta"])]).payload)
    openMenu()
    fireEvent.click(await screen.findByRole("link", { name: /^Alpha/ }))
    expect(setPreference).toHaveBeenCalledWith("notifications", {
      read: ["docs:docs-0"],
      muted: [],
    })
    expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeInTheDocument()
  })

  it("saves everything as read at once", async () => {
    await renderBell(fakePayload([source("docs", ["Alpha", "Beta"])]).payload)
    openMenu()
    fireEvent.click(await screen.findByRole("button", { name: "Mark all as read" }))
    expect(setPreference).toHaveBeenCalledWith("notifications", {
      read: ["docs:docs-0", "docs:docs-1"],
      muted: [],
    })
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument()
  })

  it("doesn't save again when an opened item was already read", async () => {
    const { payload } = fakePayload([source("docs", ["Alpha"])], {
      read: ["docs:docs-0"],
      muted: [],
    })
    await renderBell(payload)
    openMenu()
    fireEvent.click(await screen.findByRole("link", { name: /^Alpha/ }))
    expect(setPreference).not.toHaveBeenCalled()
  })

  it("saves a type muted from the settings", async () => {
    await renderBell(
      fakePayload([source("docs", ["Alpha"]), source("published", [], false)]).payload,
    )
    openMenu()
    fireEvent.click(await screen.findByRole("button", { name: "Notification settings" }))
    fireEvent.click(screen.getByRole("checkbox", { name: /Docs/ }))
    expect(setPreference).toHaveBeenCalledWith("notifications", { read: [], muted: ["docs"] })
  })
})
