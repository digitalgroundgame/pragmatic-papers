"use client"

import { formatHelpDocDate, type HelpDoc } from "@/docs"
import { Bell } from "lucide-react"
import type React from "react"
import { useEffect, useId, useRef } from "react"

import "./HelpDocsMenu.css"

const baseClass = "help-docs-menu"

interface HelpDocsMenuProps {
  docs: HelpDoc[]
  /** Slugs of the articles to mark unread and count on the bell. */
  unread: string[]
  onOpenDoc: (slug: string) => void
  onMarkAllRead: () => void
}

/** The dropdown shows this many; the rest are a click away at /docs. */
const MENU_LENGTH = 8

/**
 * The bell and its dropdown. A native popover, so it sits in the top layer: the admin header
 * clips anything that overflows it, and the popover brings light dismiss and Escape with it.
 * Nothing here imports `@payloadcms/ui`, so Storybook can render it.
 */
export function HelpDocsMenu({
  docs,
  unread,
  onOpenDoc,
  onMarkAllRead,
}: HelpDocsMenuProps): React.ReactNode {
  const id = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Hang the panel under the bell, right edges aligned, each time it opens.
  useEffect(() => {
    const popover = popoverRef.current
    if (!popover) return
    const place = (event: Event): void => {
      if ((event as ToggleEvent).newState !== "open" || !buttonRef.current) return
      const rect = buttonRef.current.getBoundingClientRect()
      popover.style.top = `${rect.bottom + 8}px`
      popover.style.right = `${Math.max(window.innerWidth - rect.right, 8)}px`
    }
    popover.addEventListener("beforetoggle", place)
    return () => popover.removeEventListener("beforetoggle", place)
  }, [])

  const count = unread.length
  const label = count ? `Help docs, ${count} unread` : "Help docs"

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${baseClass}__bell`}
        popoverTarget={id}
        aria-label={label}
        title="Help docs"
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
          <h2 className={`${baseClass}__heading`}>What&apos;s new</h2>
          {count > 0 && (
            <button type="button" className={`${baseClass}__text-button`} onClick={onMarkAllRead}>
              Mark all as read
            </button>
          )}
        </div>
        <ul className={`${baseClass}__list`}>
          {docs.slice(0, MENU_LENGTH).map((doc) => {
            const isUnread = unread.includes(doc.slug)
            return (
              <li key={doc.slug}>
                <a
                  className={`${baseClass}__item`}
                  href={`/docs/${doc.slug}`}
                  target="_blank"
                  rel="noopener"
                  onClick={() => onOpenDoc(doc.slug)}
                >
                  <span className={`${baseClass}__title`}>
                    {isUnread && <span className={`${baseClass}__dot`} aria-hidden />}
                    {doc.title}
                    {isUnread && <span className={`${baseClass}__sr-only`}> (unread)</span>}
                  </span>
                  <span className={`${baseClass}__summary`}>{doc.summary}</span>
                  <time className={`${baseClass}__date`} dateTime={doc.publishedAt}>
                    {formatHelpDocDate(doc.publishedAt)}
                  </time>
                </a>
              </li>
            )
          })}
        </ul>
        <a className={`${baseClass}__footer`} href="/docs" target="_blank" rel="noopener">
          All help docs
        </a>
      </div>
    </>
  )
}
