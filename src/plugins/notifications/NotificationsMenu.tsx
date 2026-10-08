"use client"

import { Bell, Settings } from "lucide-react"
import type React from "react"
import { useEffect, useId, useRef, useState } from "react"

import "./NotificationsMenu.css"
import type { NotificationItem, NotificationType } from "./types"
import { formatNotificationDate, itemKey } from "./unread"

const baseClass = "notifications-menu"

/** A footer link to everything of one type. */
export interface NotificationIndex {
  type: string
  label: string
  href: string
}

interface NotificationsMenuProps {
  /** Newest first, muted types already left out. */
  items: NotificationItem[]
  /** `type:id` keys of the items to mark unread and count on the bell. */
  unread: string[]
  types: NotificationType[]
  muted: string[]
  indexes: NotificationIndex[]
  onOpen: (key: string) => void
  onMarkAllRead: () => void
  onMutedChange: (muted: string[]) => void
}

/**
 * The bell and its dropdown: what's new, or with the gear, which types to show. A native
 * popover, so it sits in the top layer: the admin header clips anything that overflows it,
 * and the popover brings light dismiss and Escape with it. Nothing here imports
 * `@payloadcms/ui`, so Storybook can render it.
 */
export function NotificationsMenu({
  items,
  unread,
  types,
  muted,
  indexes,
  onOpen,
  onMarkAllRead,
  onMutedChange,
}: NotificationsMenuProps): React.ReactNode {
  const id = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<"list" | "settings">("list")

  // Hang the panel under the bell, right edges aligned, each time it opens.
  useEffect(() => {
    const popover = popoverRef.current
    if (!popover) return
    const place = (event: Event): void => {
      if ((event as ToggleEvent).newState !== "open" || !buttonRef.current) return
      setView("list")
      const rect = buttonRef.current.getBoundingClientRect()
      popover.style.top = `${rect.bottom + 8}px`
      popover.style.right = `${Math.max(window.innerWidth - rect.right, 8)}px`
    }
    popover.addEventListener("beforetoggle", place)
    return () => popover.removeEventListener("beforetoggle", place)
  }, [])

  const count = unread.length
  const label = count ? `Notifications, ${count} unread` : "Notifications"
  const settings = view === "settings"

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${baseClass}__bell`}
        popoverTarget={id}
        aria-label={label}
        title="Notifications"
      >
        <Bell aria-hidden size={20} />
        {count > 0 && (
          <span className={`${baseClass}__badge`} aria-hidden>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      <div ref={popoverRef} id={id} popover="auto" className={`${baseClass}__panel`}>
        <div className={`${baseClass}__header`}>
          <h2 className={`${baseClass}__heading`}>{settings ? "Notify me about" : "What's new"}</h2>
          <div className={`${baseClass}__actions`}>
            {!settings && count > 0 && (
              <button type="button" className={`${baseClass}__text-button`} onClick={onMarkAllRead}>
                Mark all as read
              </button>
            )}
            <button
              type="button"
              className={`${baseClass}__icon-button`}
              aria-label="Notification settings"
              aria-pressed={settings}
              onClick={() => setView(settings ? "list" : "settings")}
            >
              <Settings aria-hidden size={16} />
            </button>
          </div>
        </div>
        {settings ? (
          <ul className={`${baseClass}__list`}>
            {types.map((type) => (
              <li key={type.slug}>
                <label className={`${baseClass}__setting`}>
                  <input
                    type="checkbox"
                    checked={!muted.includes(type.slug)}
                    onChange={(event) =>
                      onMutedChange(
                        event.target.checked
                          ? muted.filter((slug) => slug !== type.slug)
                          : [...muted, type.slug],
                      )
                    }
                  />
                  <span>
                    <span className={`${baseClass}__title`}>{type.label}</span>
                    {type.description && (
                      <span className={`${baseClass}__summary`}>{type.description}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <p className={`${baseClass}__empty`}>Nothing new.</p>
        ) : (
          <ul className={`${baseClass}__list`}>
            {items.map((item) => {
              const key = itemKey(item)
              const isUnread = unread.includes(key)
              return (
                <li key={key}>
                  <a
                    className={`${baseClass}__item`}
                    href={item.href}
                    target="_blank"
                    rel="noopener"
                    onClick={() => onOpen(key)}
                  >
                    <span className={`${baseClass}__title`}>
                      {isUnread && <span className={`${baseClass}__dot`} aria-hidden />}
                      {item.title}
                      {isUnread && <span className={`${baseClass}__sr-only`}> (unread)</span>}
                    </span>
                    {item.summary && (
                      <span className={`${baseClass}__summary`}>{item.summary}</span>
                    )}
                    <time className={`${baseClass}__date`} dateTime={item.date.slice(0, 10)}>
                      {formatNotificationDate(item.date)}
                    </time>
                  </a>
                </li>
              )
            })}
          </ul>
        )}
        {!settings &&
          indexes.map((index) => (
            <a
              key={index.type}
              className={`${baseClass}__footer`}
              href={index.href}
              target="_blank"
              rel="noopener"
            >
              {index.label}
            </a>
          ))}
      </div>
    </>
  )
}
