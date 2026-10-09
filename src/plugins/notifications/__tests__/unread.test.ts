import { describe, expect, it } from "vitest"

import type { NotificationItem } from "../types"
import {
  formatNotificationDate,
  itemKey,
  parsePreference,
  unreadNotifications,
  visibleNotifications,
} from "../unread"

const item = (type: string, id: string, date: string): NotificationItem => ({
  type,
  id,
  title: id,
  href: `/${id}`,
  date,
})

const newDoc = item("docs", "new", "2026-10-18T00:00:00.000Z")
const oldDoc = item("docs", "old", "2026-09-01T00:00:00.000Z")
const published = item("article-published", "42", "2026-10-20T09:00:00.000Z")

describe("visibleNotifications", () => {
  it("leaves out muted types and puts the newest first", () => {
    expect(visibleNotifications([oldDoc, published, newDoc], []).map(itemKey)).toEqual([
      "article-published:42",
      "docs:new",
      "docs:old",
    ])
    expect(visibleNotifications([oldDoc, published, newDoc], ["docs"]).map(itemKey)).toEqual([
      "article-published:42",
    ])
  })
})

describe("unreadNotifications", () => {
  it("counts what hasn't been opened, by type and id", () => {
    expect(
      unreadNotifications([newDoc, published], ["docs:new"], "2026-01-01T00:00:00.000Z"),
    ).toEqual(["article-published:42"])
  })

  it("skips what's dated before the account was made", () => {
    expect(unreadNotifications([newDoc, oldDoc], [], "2026-10-01T12:00:00.000Z")).toEqual([
      "docs:new",
    ])
  })

  it("counts something dated the day the account was made", () => {
    expect(unreadNotifications([newDoc], [], "2026-10-18T23:00:00.000Z")).toEqual(["docs:new"])
  })
})

describe("parsePreference", () => {
  it("reads what's stored", () => {
    expect(parsePreference({ read: ["docs:a"], muted: ["docs"] })).toEqual({
      read: ["docs:a"],
      muted: ["docs"],
    })
  })

  it("treats a missing or malformed preference as nothing read or muted", () => {
    expect(parsePreference(undefined)).toEqual({ read: [], muted: [] })
    expect(parsePreference({ read: "a", muted: [1, "docs"] })).toEqual({
      read: [],
      muted: ["docs"],
    })
  })
})

describe("formatNotificationDate", () => {
  it("shows the calendar day whatever the time zone", () => {
    expect(formatNotificationDate("2026-10-18T00:00:00.000Z")).toBe("October 18, 2026")
  })
})
