import type { NotificationItem, NotificationsPreference } from "./types"

/** The payload-preferences key the bell keeps its state under. */
export const PREFERENCE_KEY = "notifications"

export const itemKey = (item: Pick<NotificationItem, "type" | "id">): string =>
  `${item.type}:${item.id}`

const day = (iso: string | undefined): string => iso?.slice(0, 10) ?? ""

/** Items of types the user hasn't muted, newest first. */
export const visibleNotifications = (
  items: NotificationItem[],
  muted: string[],
): NotificationItem[] =>
  items
    .filter((item) => !muted.includes(item.type))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

/**
 * The keys of `items` that count as unread: not opened, and dated no earlier than the day
 * the account was made, so someone joining the staff doesn't start with every doc ever written.
 */
export const unreadNotifications = (
  items: NotificationItem[],
  read: string[],
  userCreatedAt: string | undefined,
): string[] => {
  const joined = day(userCreatedAt)
  return items
    .filter((item) => !read.includes(itemKey(item)) && day(item.date) >= joined)
    .map(itemKey)
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []

/** A stored preference, or nothing read or muted when it's missing or malformed. */
export const parsePreference = (value: unknown): NotificationsPreference => {
  const stored = (value ?? {}) as Partial<Record<keyof NotificationsPreference, unknown>>
  return { read: strings(stored.read), muted: strings(stored.muted) }
}

/** "October 18, 2026": the calendar day, read in UTC so it isn't shifted a day. */
export const formatNotificationDate = (date: string): string =>
  new Date(`${day(date)}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  })
