/**
 * How each public page lays itself out today, for the design guide's page audit
 * ("Design guide/Page audit"). Measured on a seeded local site at 390px and 1280px wide.
 *
 * `wrapper` is the class list on the page's outermost element, copied from `source`:
 * `__tests__/pageLayouts.test.ts` fails when a page's wrapper changes, so whoever fixes a
 * layout updates its entry (and drops the deviations it fixed) in the same PR.
 */

export type ColumnWidth = "max-w-xl" | "max-w-3xl" | "max-w-5xl" | "container" | "docs" | "centered"

export interface PageLayout {
  route: string
  name: string
  /** The file that sets the wrapper, from the repo root. */
  source: string
  /** The outermost element's classes, exactly as `source` writes them. */
  wrapper: string
  column: ColumnWidth
  /** Width of the content column at a 1280px viewport, in px, and its left edge. */
  desktop: { left: number; width: number }
  breadcrumbs: "column" | "full width" | "none"
  /** The h1's size at phone / desktop widths; "none" when the page has no h1. */
  h1: string
  /** Space between the page's last text and the footer at 1280px, in px. */
  bottomGap: number
  /** Where the page departs from the common pattern. Empty when it follows it. */
  deviations: string[]
}

/**
 * The pattern most pages follow, which the deviations are measured against: breadcrumbs, then
 * a `mx-auto max-w-3xl space-y-6 px-4` column (text from x=272 to 1008 at 1280px) with a 36 /
 * 48px h1, a muted text-sm description under it, and sections split by Separators.
 */
export const COMMON_PATTERN = "mx-auto max-w-3xl space-y-6 px-4"

export const PAGE_LAYOUTS: PageLayout[] = [
  {
    route: "/topics",
    name: "Topics",
    source: "src/app/(frontend)/topics/page.tsx",
    wrapper: "mx-auto max-w-3xl space-y-6 px-4",
    column: "max-w-3xl",
    desktop: { left: 272, width: 736 },
    breadcrumbs: "column",
    h1: "36 / 48px",
    bottomGap: 92,
    deviations: [],
  },
  {
    route: "/topics/[slug]",
    name: "Topic",
    source: "src/app/(frontend)/topics/[slug]/page.tsx",
    wrapper: "mx-auto max-w-3xl space-y-6 px-4",
    column: "max-w-3xl",
    desktop: { left: 272, width: 736 },
    breadcrumbs: "column",
    h1: "36 / 48px",
    bottomGap: 55,
    deviations: [],
  },
  {
    route: "/contributors",
    name: "Contributors",
    source: "src/app/(frontend)/contributors/page.tsx",
    wrapper: "mx-auto max-w-3xl space-y-6 px-4",
    column: "max-w-3xl",
    desktop: { left: 272, width: 736 },
    breadcrumbs: "column",
    h1: "36 / 48px",
    bottomGap: 55,
    deviations: [
      "On phones the “Meet the Contributors” h2 wraps to two lines beside the result count.",
    ],
  },
  {
    route: "/contributors/[slug]",
    name: "Contributor",
    source: "src/app/(frontend)/contributors/[slug]/page.tsx",
    wrapper: "mx-auto max-w-3xl space-y-6 px-4",
    column: "max-w-3xl",
    desktop: { left: 272, width: 736 },
    breadcrumbs: "column",
    h1: "36 / 48px",
    bottomGap: 1,
    deviations: [
      "The header (avatar, name, role) is centered; every other page's header is left-aligned.",
      "A Separator with my-16 between the bio and the articles: 64px, where other pages leave 24px around one (my-6).",
      "No space under the last article card before the footer.",
      "An author with no articles shows “Search produced no results.” (PageRange) beside “Look out for this author's debut!”.",
    ],
  },
  {
    route: "/search",
    name: "Search",
    source: "src/app/(frontend)/search/page.tsx",
    wrapper: "mx-auto max-w-3xl space-y-6 px-4",
    column: "max-w-3xl",
    desktop: { left: 272, width: 736 },
    breadcrumbs: "column",
    h1: "36 / 48px",
    bottomGap: 43,
    deviations: [
      "The column is a second <main> inside the layout's <main>, so the page has two main landmarks.",
      "The search field and button are hand-styled <input> and <button> (h-10, rounded-md) rather than the Input and Button components (h-8, rounded-sm), so they're taller and rounder than every other control.",
      "A search with no results says “Search produced no results.” twice.",
    ],
  },
  {
    route: "/volumes/[slug]",
    name: "Volume",
    source: "src/app/(frontend)/volumes/[slug]/page.tsx",
    wrapper: "mx-auto max-w-3xl space-y-3 px-4",
    column: "max-w-3xl",
    desktop: { left: 272, width: 736 },
    breadcrumbs: "column",
    h1: "60 / 72px",
    bottomGap: 14,
    deviations: [
      "The h1 is text-6xl lg:text-7xl, the largest title on the site.",
      "space-y-3 between sections where other pages use space-y-6.",
    ],
  },
  {
    route: "/[slug]",
    name: "Pages built from blocks (About, Articles, Feeds and sitemaps)",
    source: "src/app/(frontend)/[slug]/page.tsx",
    wrapper: "<article>",
    column: "max-w-3xl",
    desktop: { left: 272, width: 736 },
    breadcrumbs: "column",
    h1: "48 / 56px",
    bottomGap: 30,
    deviations: [
      "No wrapper of its own: each hero and block sets its own width, so a page is only as consistent as the blocks an editor picks (most use container max-w-3xl, CollectionGrid and Merch the full container).",
      "The title is a rich-text h1, which prose sets at 48 / 56px, a step larger than coded pages' 36 / 48px.",
      "Whether there's an h1 at all is up to the editor: About has none.",
    ],
  },
  {
    route: "/",
    name: "Home",
    source: "src/app/(frontend)/page.tsx",
    wrapper: "<article>",
    column: "container",
    desktop: { left: 16, width: 1248 },
    breadcrumbs: "none",
    h1: "none",
    bottomGap: 140,
    deviations: [
      "No h1: the newest volume's grid starts the page.",
      "Uses the full container where index pages use the max-w-3xl column (intended: it's a front page).",
    ],
  },
  {
    route: "/articles/[slug]",
    name: "Article",
    source: "src/app/(frontend)/articles/[slug]/page.tsx",
    wrapper: "mx-auto max-w-5xl min-w-0 space-y-6 px-4",
    column: "max-w-5xl",
    desktop: { left: 144, width: 992 },
    breadcrumbs: "none",
    h1: "36 / 48px",
    bottomGap: 20,
    deviations: [
      "No visible breadcrumbs (the trail is only in the JSON-LD), unlike every other content page.",
      "Two widths on one page: the hero, title and byline span max-w-5xl, the body max-w-2xl centered under them, so the title's left edge doesn't line up with the text's.",
      "Recommended articles sit in container max-w-3xl, wider than the body above them (max-w-2xl), so neither their edges nor their top rule line up with it.",
    ],
  },
  {
    route: "/account",
    name: "Account",
    source: "src/app/(frontend)/account/page.tsx",
    wrapper: "mx-auto max-w-xl space-y-8 px-4 pb-16",
    column: "max-w-xl",
    desktop: { left: 368, width: 544 },
    breadcrumbs: "none",
    h1: "36 / 48px",
    bottomGap: 128,
    deviations: [
      "max-w-xl, the only page that narrow, so its left edge (368px) matches nothing else.",
      "No breadcrumbs, so its title sits 36px higher than other pages'.",
      "space-y-8 and its own pb-16, where other pages use space-y-6 and no bottom padding.",
    ],
  },
  {
    route: "/interactives/[slug]",
    name: "Interactive",
    source: "src/app/(frontend)/interactives/[slug]/page.tsx",
    wrapper: "container pt-8 pb-16",
    column: "container",
    desktop: { left: 16, width: 1248 },
    breadcrumbs: "full width",
    h1: "36 / 48px",
    bottomGap: 50,
    deviations: [
      "Full container width, with full-width breadcrumbs, so its title starts at the page's edge (16px) rather than the column's (272px). Intended for the map; the header and intro could still sit in the column.",
      "pt-8 above the title on top of the breadcrumbs' gap, and its own pb-16.",
      "A text-xs uppercase brand eyebrow (“Interactive”) above the title, which no other page title has.",
    ],
  },
  {
    route: "/docs/[...path]",
    name: "Docs",
    source: "src/app/(frontend)/docs/[...path]/DocView.tsx",
    wrapper: "@container min-w-0 space-y-6",
    column: "docs",
    desktop: { left: 296, width: 968 },
    breadcrumbs: "column",
    h1: "32 / 36px",
    bottomGap: 83,
    deviations: [
      "A layout of its own (DocsLayout): the minimal header, a sidebar of the docs tree, and a column that fills the rest. Intended, as a wiki.",
      "Headings in Geist, not FKScreamer (DocsLayout sets them), and a smaller h1.",
    ],
  },
  {
    route: "(not found)",
    name: "404",
    source: "src/app/(frontend)/not-found.tsx",
    wrapper: "py-28",
    column: "centered",
    desktop: { left: 569, width: 142 },
    breadcrumbs: "none",
    h1: "36 / 48px",
    bottomGap: 119,
    deviations: [
      "Centered in an Empty state, with the h1 in brand-text (“404”) and the page's name as a smaller line under it.",
    ],
  },
]

/** Things every page differs on, which no single entry above shows. */
export const SITE_WIDE_FINDINGS: string[] = [
  "No shared page shell. Each page sets its own width, padding and spacing, so the same column is written out by hand in six pages (mx-auto max-w-3xl … px-4) and the others each pick their own.",
  "The space between a page's last line and the footer ranges from none to 140px, because only Account and Interactive pad their own bottom; the rest end wherever their last element's margin does.",
  "Four h1 sizes: 36 / 48px on coded pages, 48 / 56px from rich text, 60 / 72px on a volume, 32 / 36px in the docs.",
  "Three content widths for a page's main text: max-w-xl (account), max-w-2xl (article and doc bodies) and max-w-3xl (everything else).",
  "Section spacing is space-y-3, space-y-6 or space-y-8 depending on the page, and Separators sit at my-6 or my-16.",
  "Two reds for errors: destructive (components) and error (the Banner block).",
  "From lg up the header is 59px tall, not the 57px --header-height says (the logo link is 34px there, the buttons 32px), so the sticky ticker, the article sidebar and anchor links sit 2px under it.",
]
