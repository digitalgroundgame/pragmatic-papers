"use client"

import { Bell, Settings } from "lucide-react"
import type React from "react"
import { useId, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty, EmptyDescription } from "@/components/ui/empty"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { LinkButton } from "@/components/ui/link-button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

import "./NotificationsMenu.css"
import type { NotificationItem, NotificationType } from "./types"
import { formatNotificationDate, itemKey } from "./unread"

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
 * The bell and its dropdown: what's new, or with the gear, which types to show. Built from
 * the site's shadcn components, styled in the admin by NotificationsMenu.css. Nothing here
 * imports `@payloadcms/ui`, so Storybook can render it.
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
  const [view, setView] = useState<"list" | "settings">("list")

  const count = unread.length
  const settings = view === "settings"

  return (
    <Popover onOpenChange={(open) => open && setView("list")}>
      <PopoverTrigger
        render={
          // Outlined like Payload's own icon buttons: a thin border that darkens on hover or
          // while open, never a fill.
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-lg border-(--theme-elevation-200) bg-transparent hover:border-(--theme-elevation-400) hover:bg-transparent aria-expanded:border-(--theme-elevation-400) aria-expanded:bg-transparent dark:hover:bg-transparent"
            aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
            title="Notifications"
          />
        }
      >
        <Bell aria-hidden className="size-5" />
        {count > 0 && (
          // Not the brand orange: white text on it is too faint at this size.
          <Badge
            aria-hidden
            className="absolute -top-0.5 -right-1 h-4.5 min-w-4.5 bg-[#b3261e] px-1 text-[11px] text-white"
          >
            {count > 9 ? "9+" : count}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        aria-labelledby={`${id}-heading`}
        className="flex max-h-[min(32rem,var(--available-height))] w-[min(22rem,calc(100vw-1rem))] flex-col p-0"
      >
        <div className="flex items-center justify-between gap-2 py-2 pr-2 pl-4">
          <h2
            id={`${id}-heading`}
            className="m-0 font-sans text-sm leading-normal font-semibold tracking-normal"
          >
            {settings ? "Notify me about" : "What's new"}
          </h2>
          <div className="flex items-center gap-1">
            {!settings && count > 0 && (
              <Button variant="link" size="sm" onClick={onMarkAllRead}>
                Mark all as read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Notification settings"
              aria-pressed={settings}
              onClick={() => setView(settings ? "list" : "settings")}
            >
              <Settings aria-hidden />
            </Button>
          </div>
        </div>
        <Separator />
        {settings ? (
          <div className="flex flex-col gap-4 overflow-y-auto p-4">
            {types.map((type) => (
              <Field key={type.slug} orientation="horizontal">
                <Checkbox
                  id={`${id}-${type.slug}`}
                  checked={!muted.includes(type.slug)}
                  onCheckedChange={(checked) =>
                    onMutedChange(
                      checked ? muted.filter((slug) => slug !== type.slug) : [...muted, type.slug],
                    )
                  }
                />
                <FieldContent>
                  <FieldLabel htmlFor={`${id}-${type.slug}`}>{type.label}</FieldLabel>
                  {type.description && <FieldDescription>{type.description}</FieldDescription>}
                </FieldContent>
              </Field>
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty className="p-6">
            <EmptyDescription>Nothing new.</EmptyDescription>
          </Empty>
        ) : (
          <ul className="divide-border m-0 list-none divide-y overflow-y-auto p-0">
            {items.map((item) => {
              const key = itemKey(item)
              const isUnread = unread.includes(key)
              return (
                <li key={key}>
                  <a
                    className="hover:bg-muted focus-visible:bg-muted flex gap-3 px-4 py-3 text-inherit no-underline outline-none"
                    href={item.href}
                    target="_blank"
                    rel="noopener"
                    onClick={() => onOpen(key)}
                  >
                    {item.image && (
                      // Decorative: the title beside it says what it's about. The square crop is
                      // already small, so it needs none of next/image's resizing.
                      // eslint-disable-next-line @next/next/no-img-element -- a fixed 48px thumbnail
                      <img
                        src={item.image.url}
                        alt=""
                        loading="lazy"
                        width={48}
                        height={48}
                        className="bg-muted border-border mt-0.5 size-12 shrink-0 rounded-md border object-cover"
                      />
                    )}
                    <span className="flex min-w-0 flex-col gap-1">
                      {/* Inline, so a long title wraps under the dot rather than beside it. */}
                      <span className="text-sm font-semibold">
                        {isUnread && (
                          <span
                            aria-hidden
                            className="bg-brand mr-2 inline-block size-2 rounded-full align-middle"
                          />
                        )}
                        {item.title}
                        {isUnread && <span className="sr-only"> (unread)</span>}
                      </span>
                      {item.summary && (
                        <span className="text-muted-foreground text-sm">{item.summary}</span>
                      )}
                      <time
                        className="text-muted-foreground text-xs"
                        dateTime={item.date.slice(0, 10)}
                      >
                        {formatNotificationDate(item.date)}
                      </time>
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        )}
        {!settings && indexes.length > 0 && (
          <>
            <Separator />
            <div className="flex justify-center p-1">
              {indexes.map((index) => (
                <LinkButton
                  key={index.type}
                  variant="ghost"
                  className="w-full"
                  href={index.href}
                  target="_blank"
                  rel="noopener"
                >
                  {index.label}
                </LinkButton>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
