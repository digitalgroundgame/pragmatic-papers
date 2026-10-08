import type { Role } from "@/access/roles"

/**
 * A help article at /docs/<slug>, about something staff can now do in the admin. Its body is
 * `src/docs/<slug>.md`; this entry is what the admin's help bell and the /docs index show, so
 * neither has to load the bodies.
 */
export interface HelpDoc {
  slug: string
  title: string
  /** One or two sentences: the bell's dropdown shows it under the title. */
  summary: string
  /** `YYYY-MM-DD`, the day the feature reaches production (the release it ships in). */
  publishedAt: string
  /**
   * The roles it's for. Admins and chief editors see every article; leave it out for everyone
   * on staff.
   */
  audience?: Role[]
}

/** Newest first. Adding one: write `src/docs/<slug>.md` and list it here (see AGENTS.md). */
export const helpDocs: HelpDoc[] = [
  {
    slug: "unsplash-photos",
    title: "Find a photo on Unsplash without leaving the admin",
    summary:
      "Search Unsplash from any Media upload. The photographer's credit goes into the caption for you.",
    publishedAt: "2026-10-18",
  },
  {
    slug: "experiments",
    title: "Switch beta features on per site in Site Settings",
    summary: "Experiments let a new feature run on staging before readers on the live site see it.",
    publishedAt: "2026-10-18",
    audience: ["admin"],
  },
]

export const findHelpDoc = (slug: string): HelpDoc | undefined =>
  helpDocs.find((doc) => doc.slug === slug)

/** "October 18, 2026". `publishedAt` is a calendar day, so it's read in UTC, not shifted a day. */
export const formatHelpDocDate = (publishedAt: string): string =>
  new Date(`${publishedAt}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  })
