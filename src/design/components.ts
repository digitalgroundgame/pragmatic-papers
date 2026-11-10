/**
 * Which component to reach for, for the design guide's Components page. Each links to its
 * stories by Storybook id (the story title, lowercased and dashed).
 */

export interface ComponentLink {
  name: string
  /** The story title, e.g. "UI/Button". */
  title: string
}

export interface ComponentUse {
  need: string
  components: ComponentLink[]
  notes?: string
}

const ui = (name: string, title = name.replace(/ /g, "")): ComponentLink => ({
  name,
  title: `UI/${title}`,
})
const site = (name: string, title = `Components/${name}`): ComponentLink => ({ name, title })

/** Storybook's id for a docs page: "UI/LinkButton" → "ui-linkbutton--docs". */
export function storyDocsId(title: string): string {
  return `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}--docs`
}

export const PRIMITIVES: ComponentUse[] = [
  {
    need: "A button",
    components: [ui("Button"), ui("LinkButton")],
    notes:
      "h-8, rounded-sm. default (black / white), outline, ghost for icons, branded for the one orange call to action (Donate).",
  },
  { need: "A label on something", components: [ui("Badge")], notes: "brand for topics." },
  { need: "A divider", components: [ui("Separator")], notes: "my-6 between sections." },
  {
    need: "A boxed item",
    components: [ui("Card")],
    notes: "Override to rounded-sm, as every card on the site does.",
  },
  {
    need: "Text fields",
    components: [ui("Input"), ui("Textarea"), ui("Field"), ui("Label")],
    notes: "h-8, rounded-sm.",
  },
  {
    need: "Nothing to show",
    components: [ui("Empty")],
    notes:
      "The 404 pages and the notifications bell. Empty lists on pages are plain muted text today.",
  },
  { need: "Loading", components: [ui("Skeleton")], notes: "Match the loaded layout's shapes." },
  {
    need: "Menus and panels",
    components: [
      ui("Dropdown menu", "DropdownMenu"),
      ui("Popover"),
      ui("Sheet"),
      ui("Dialog"),
      ui("Tooltip"),
    ],
    notes: "Load them lazily where they're on every page (AGENTS.md).",
  },
  { need: "Pages of results", components: [ui("Pagination")], notes: "Centered under the list." },
  { need: "A brand flourish", components: [ui("Squiggle")], notes: "The end-of-article rule." },
]

export const SITE_COMPONENTS: ComponentUse[] = [
  { need: "The trail above a page", components: [site("Breadcrumbs")] },
  { need: "An article in a grid", components: [site("ArticleCard")] },
  { need: "An article in a list", components: [site("AuthorArticleCard")] },
  { need: "A person", components: [site("Authors"), site("Byline")] },
  { need: "Rich text", components: [site("RichText")] },
  { need: "Images and video", components: [site("Media")] },
  { need: "Sharing", components: [site("ShareButtons")] },
  { need: "Topics on an article", components: [site("TopicsList")] },
  {
    need: "The page frame",
    components: [site("Header", "Layout/Header"), site("Footer", "Layout/Footer"), site("Ticker")],
  },
  {
    need: "A page's opening",
    components: [site("Heros", "Heros/RenderHero"), site("ArticleHero", "Heros/ArticleHero")],
  },
]
