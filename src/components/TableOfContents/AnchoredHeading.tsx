"use client"

import { type JSX, type MouseEvent, type ReactNode, useId } from "react"

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6"

export interface AnchoredHeadingProps {
  tag: HeadingTag
  /** The heading's stored anchor, its `id` and the hash it links to. */
  id: string
  /** The link icon, already rendered (a component can't cross into a client file). */
  icon: ReactNode
  children: ReactNode
}

/**
 * A heading that links to itself without being a link: dragging across a link drags
 * the link, so a heading wrapped in one can't have its text selected. The text stays
 * plain, the icon beside it is the link (for keyboards and without JavaScript), and a
 * click on the text follows it too, unless the click ended a selection or starts a
 * double or triple click that selects a word or the line.
 */
/**
 * How long a click waits for the next one before it jumps. A double click selects its
 * word on the second click, so jumping on the first would scroll the word away first.
 */
export const MULTI_CLICK_WAIT_MS = 300

const hasSelection = (): boolean => window.getSelection()?.isCollapsed === false

export function AnchoredHeading({
  tag: Tag,
  id,
  icon,
  children,
}: AnchoredHeadingProps): JSX.Element {
  const textId = useId()

  const followOnClick = (event: MouseEvent<HTMLHeadingElement>) => {
    if (event.defaultPrevented || event.button !== 0) return
    // A link inside the heading (the icon, or one the writer added) goes where it goes.
    if ((event.target as Element).closest("a")) return
    // Dragging to select text ends in a click; don't jump away from what was selected.
    if (event.detail > 1 || hasSelection()) return
    window.setTimeout(() => {
      if (!hasSelection()) window.location.hash = id
    }, MULTI_CLICK_WAIT_MS)
  }

  return (
    // The icon link is the keyboard's way in; the click on the text is a shortcut for the mouse.
    <Tag id={id} aria-labelledby={textId} className="group cursor-pointer" onClick={followOnClick}>
      <span id={textId}>{children}</span>
      <a
        href={`#${id}`}
        aria-labelledby={textId}
        className="text-muted-foreground ml-1 inline-flex align-baseline no-underline opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        {icon}
      </a>
    </Tag>
  )
}
