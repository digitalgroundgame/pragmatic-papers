/** One stop on a tour: a popover pointing at something on one admin page. */
export interface TourStep {
  /**
   * The admin page the step is on, e.g. `/admin/collections/articles`. A `:param` segment
   * matches any one segment, so `/admin/collections/articles/:id` is any article's edit view.
   * When the reader isn't on it, the tour goes there first, so a fixed path must be one the
   * tour can open directly.
   */
  path: string
  /**
   * A CSS selector for what the popover points at. Payload's admin markup isn't ours, so use
   * its stable hooks (ids such as `#nav-articles` or `#field-title`, and its BEM block classes),
   * never generated class names. Left out, the popover sits in the middle of the page.
   */
  element?: string
  title: string
  description: string
  side?: "top" | "right" | "bottom" | "left"
  /**
   * Next follows the link at `element` (or the link inside it) instead of only moving on, so a
   * tour can open a document whose id it can't know, like the first row of a list.
   */
  follow?: boolean
}

/** A guided tour of a feature in the admin, started from a link (see `tourHref`). */
export interface Tour {
  /** Stable: docs and notifications refer to a tour by it. */
  key: string
  title: string
  steps: TourStep[]
}
