/**
 * The site's design tokens as they are today, for the design guide in Storybook
 * ("Design guide/…"). The values live in `src/app/(frontend)/globals.css`; this file only
 * names them, groups them and says what each is for, and the swatches read the live value
 * from the CSS, so nothing here can drift from what the site renders.
 * `__tests__/tokens.test.ts` fails when globals.css gains a custom property this file
 * doesn't list.
 */

export interface ColorToken {
  /** The CSS custom property, without the leading dashes. */
  name: string
  /** The Tailwind utility the token is reached through, as most code uses it. */
  utility: string
  use: string
}

export interface ColorGroup {
  title: string
  description: string
  tokens: ColorToken[]
}

export const COLOR_GROUPS: ColorGroup[] = [
  {
    title: "Brand",
    description:
      "One brand color, #ff401a, which never changes. It's too light for text on white (3.49:1), so two siblings carry it where contrast matters.",
    tokens: [
      {
        name: "brand",
        utility: "bg-brand / border-brand",
        use: "Exactly #ff401a in both themes. Marks, borders, rules and fills with no text on them (the logo's square, blockquote borders, the squiggle).",
      },
      {
        name: "brand-text",
        utility: "text-brand-text",
        use: "Brand-colored text: eyebrows, volume numbers, the 404. AA on each theme's background (4.52:1 light, 6.60:1 dark).",
      },
      {
        name: "brand-fill",
        utility: "bg-brand-fill",
        use: "Behind white labels: the branded button and badge, and text selection. The same in both themes (4.52:1 with white).",
      },
    ],
  },
  {
    title: "Surfaces and text",
    description:
      "shadcn's neutral palette. Body text is foreground; secondary text is muted-foreground. The off-white primary reads dingy in dark mode, so only the link variants of Button and Badge still set text in it.",
    tokens: [
      { name: "background", utility: "bg-background", use: "The page." },
      {
        name: "foreground",
        utility: "text-foreground",
        use: "Body text, titles and links.",
      },
      { name: "muted", utility: "bg-muted", use: "Quiet fills: hover rows, code, skeletons." },
      {
        name: "muted-foreground",
        utility: "text-muted-foreground",
        use: "Secondary text: dates, captions, descriptions, counts.",
      },
      { name: "card", utility: "bg-card", use: "Cards (a step up from the page in dark mode)." },
      { name: "card-foreground", utility: "text-card-foreground", use: "Text on a card." },
      { name: "popover", utility: "bg-popover", use: "Menus, popovers, tooltips, sheets." },
      { name: "popover-foreground", utility: "text-popover-foreground", use: "Text in them." },
      {
        name: "primary",
        utility: "bg-primary",
        use: "The default button's fill. Not for text (use foreground).",
      },
      {
        name: "primary-foreground",
        utility: "text-primary-foreground",
        use: "The default button's label.",
      },
      { name: "secondary", utility: "bg-secondary", use: "The secondary button." },
      {
        name: "secondary-foreground",
        utility: "text-secondary-foreground",
        use: "Its label.",
      },
      { name: "accent", utility: "bg-accent", use: "Hovered and selected menu items." },
      { name: "accent-foreground", utility: "text-accent-foreground", use: "Their text." },
    ],
  },
  {
    title: "Lines and focus",
    description: "Every element's border defaults to border (globals.css base layer).",
    tokens: [
      { name: "border", utility: "border-border", use: "Rules, card and image outlines." },
      { name: "input", utility: "border-input", use: "Form controls' borders." },
      { name: "ring", utility: "ring-ring", use: "Focus rings, usually at 50%." },
    ],
  },
  {
    title: "Status",
    description:
      "destructive is shadcn's, and what the components use; error, success and warning are ours, used by the Banner block. error and destructive are two near-identical reds.",
    tokens: [
      {
        name: "destructive",
        utility: "text-destructive",
        use: "Invalid fields, destructive buttons, form errors.",
      },
      { name: "error", utility: "border-error", use: "The Banner block's error style." },
      { name: "success", utility: "border-success", use: "The Banner block's success style." },
      { name: "warning", utility: "border-warning", use: "The Banner block's warning style." },
    ],
  },
  {
    title: "Maps",
    description:
      "The election maps' diverging scale, read through var() by the choropleth block and the drilldown pages. The same in both themes.",
    tokens: [
      ...[1, 2, 3, 4].map((step) => ({
        name: `map-positive-${step}`,
        utility: `var(--map-positive-${step})`,
        use: step === 1 ? "R+, lightest to strongest." : "",
      })),
      ...[1, 2, 3, 4].map((step) => ({
        name: `map-negative-${step}`,
        utility: `var(--map-negative-${step})`,
        use: step === 1 ? "D+, lightest to strongest." : "",
      })),
      { name: "map-neutral", utility: "var(--map-neutral)", use: "Regions with no value." },
    ],
  },
  {
    title: "Charts",
    description:
      "shadcn's chart blues. Nothing uses them today: the Federal Courts charts color by party.",
    tokens: [1, 2, 3, 4, 5].map((step) => ({
      name: `chart-${step}`,
      utility: `fill-chart-${step}`,
      use: "",
    })),
  },
  {
    title: "Sidebar",
    description:
      "shadcn's sidebar palette, for components/ui/sidebar, which only the drilldown map's selector uses. In dark mode sidebar-primary is a blue nothing else on the site uses.",
    tokens: [
      "sidebar",
      "sidebar-foreground",
      "sidebar-primary",
      "sidebar-primary-foreground",
      "sidebar-accent",
      "sidebar-accent-foreground",
      "sidebar-border",
      "sidebar-ring",
    ].map((name) => ({ name, utility: `bg-${name}`, use: "" })),
  },
]

/** Custom properties in globals.css that aren't colors, and where the guide covers them. */
export const OTHER_TOKENS: Record<string, string> = {
  radius: "Spacing and shape",
  "header-height": "Layout",
  "sticky-top": "Layout",
  "ticker-height": "Layout",
}

export interface FontFamily {
  name: string
  utility: string
  /** The family the browser is asked for first. */
  stack: string
  use: string
}

export const FONT_FAMILIES: FontFamily[] = [
  {
    name: "FKScreamer Bold",
    utility: "font-display",
    stack: "var(--font-display)",
    use: "Every h1–h6 (globals.css base layer), uppercase-free, bold, tracking-wide, leading-none. Licensed: subsetting only.",
  },
  {
    name: "Geist",
    utility: "font-sans",
    stack: "var(--font-sans)",
    use: "The interface: navigation, buttons, forms, metadata, the docs. The <html> default.",
  },
  {
    name: "System serif",
    utility: "font-serif",
    stack: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    use: "Reading text: RichText bodies, article card excerpts, bylines, dates. Tailwind's default stack, so it's New York on Apple devices and Georgia elsewhere.",
  },
]

export interface TypeStep {
  label: string
  /** Classes that produce it, as the code writes them. */
  classes: string
  /** Rendered size at phone / desktop widths. */
  size: string
  where: string
}

/** Headings as the site sets them: the base layer for plain h1–h3, and RichText's prose. */
export const HEADING_SCALE: TypeStep[] = [
  {
    label: "Volume title",
    classes: "text-6xl lg:text-7xl",
    size: "60 / 72px",
    where: "/volumes/[slug] only",
  },
  {
    label: "Rich text h1",
    classes: "prose-lg md:prose-xl",
    size: "48 / 56px",
    where: "Pages built from blocks (Articles, Feeds and sitemaps, About)",
  },
  {
    label: "h1",
    classes: "text-4xl md:text-5xl",
    size: "36 / 48px",
    where: "Page titles: articles, topics, contributors, search, account",
  },
  {
    label: "h2",
    classes: "text-3xl md:text-4xl",
    size: "32 / 36px",
    where: "Section titles",
  },
  {
    label: "Rich text h2",
    classes: "prose-h2:text-4xl md:prose-h2:text-5xl",
    size: "36 / 48px",
    where: "Headings inside an article (bigger than a page's own h2)",
  },
  {
    label: "h3",
    classes: "text-2xl md:text-3xl",
    size: "24 / 32px",
    where: "Card titles, subsections",
  },
]

export const TEXT_SCALE: TypeStep[] = [
  {
    label: "Article body",
    classes: "font-serif prose-lg md:prose-xl",
    size: "18 / 20px, leading-relaxed",
    where: "RichText",
  },
  {
    label: "Dek",
    classes: "text-lg md:text-xl text-muted-foreground",
    size: "18 / 20px",
    where: "Docs summaries, What's new",
  },
  {
    label: "Interface",
    classes: "text-sm",
    size: "14px",
    where: "Buttons, menus, form fields, descriptions under titles",
  },
  {
    label: "Metadata",
    classes: "text-xs text-muted-foreground",
    size: "12px",
    where: "Dates, counts, search result types",
  },
]

export interface RadiusStep {
  utility: string
  value: string
  use: string
}

/** --radius is 0.625rem (10px); Tailwind's radius steps are multiples of it. */
export const RADII: RadiusStep[] = [
  {
    utility: "rounded-sm",
    value: "6px",
    use: "The site's default: buttons, inputs, popovers, thumbnails, and every card (the Card component's own rounded-xl is overridden to it)",
  },
  { utility: "rounded-md", value: "8px", use: "Menu items and tooltips" },
  { utility: "rounded-lg", value: "10px", use: "The interactive page's empty state" },
  { utility: "rounded-xl", value: "14px", use: "Dialogs, and Card before a page overrides it" },
  {
    utility: "rounded-full",
    value: "9999px",
    use: "Avatars, dots, the topic badges (rounded-4xl)",
  },
]

export interface Breakpoint {
  name: string
  minWidth: string
  changes: string
}

/** Tailwind's defaults; the site doesn't override them. */
export const BREAKPOINTS: Breakpoint[] = [
  { name: "(base)", minWidth: "0", changes: "Phones: one column, the mobile menu, no mega menu." },
  { name: "sm", minWidth: "40rem (640px)", changes: "Two-column grids (volume articles)." },
  {
    name: "md",
    minWidth: "48rem (768px)",
    changes: "Headings step up, the mega menu appears, the ticker starts sticking.",
  },
  {
    name: "lg",
    minWidth: "64rem (1024px)",
    changes: "Header actions and mode toggle leave the sheet; the article's TOC moves beside it.",
  },
  { name: "xl", minWidth: "80rem (1280px)", changes: "The container stops growing." },
  { name: "2xl", minWidth: "96rem (1536px)", changes: "Nothing uses it." },
]

export interface Width {
  utility: string
  rem: number
  use: string
}

/** The content widths pages and blocks use, narrowest first. */
export const WIDTHS: Width[] = [
  { utility: "max-w-xl", rem: 36, use: "The account page" },
  { utility: "max-w-2xl", rem: 42, use: "Article and doc body text (the reading column)" },
  {
    utility: "max-w-3xl",
    rem: 48,
    use: "The standard column: breadcrumbs, index pages, page heroes, most blocks",
  },
  {
    utility: "max-w-5xl",
    rem: 64,
    use: "The article page (hero image, title, TOC beside the body)",
  },
  {
    utility: "container",
    rem: 80,
    use: "Header, footer, home page grids, the interactive page: full width up to 80rem, px-4",
  },
]

export interface SpacingUse {
  where: string
  classes: string
  size: string
}

/** The spacing the pages repeat. Tailwind's 4px scale; no tokens of our own. */
export const SPACING: SpacingUse[] = [
  { where: "Page gutter, every width", classes: "px-4 (and the container's own)", size: "16px" },
  { where: "Between a page's sections", classes: "space-y-6", size: "24px" },
  { where: "Breadcrumbs to the page", classes: "mb-4", size: "16px" },
  { where: "Title to its description", classes: "space-y-2 / space-y-3", size: "8–12px" },
  { where: "Around a Separator", classes: "my-6", size: "24px" },
  { where: "Between cards in a list", classes: "gap-4", size: "16px" },
  { where: "Between cards in a grid", classes: "gap-6", size: "24px" },
  { where: "Inside a card", classes: "py-4 px-4 (Card, CardContent)", size: "16px" },
  {
    where: "Blocks on built pages",
    classes: "mb-9 md:mb-12, or my-4 / my-8",
    size: "36–48px, or 16–32px",
  },
  { where: "Header", classes: "py-3, gap-4", size: "12px, 16px" },
]
