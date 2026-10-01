import type {
  BannerBlock,
  CodeBlock,
  DisplayMathBlock,
  FootnoteBlock,
  FootnotesField,
  InlineMathBlock,
  InteractiveMapBlock,
  MapAsset,
  Media,
  MediaCollageBlock,
  SocialEmbedBlock,
  SquiggleRuleBlock,
  TimelineBlock,
} from "@/payload-types"

import { mediaFixture, portraitImage, squareImage, wideImage } from "./media"
import { createLinkNode, createParagraph, createTextNode, richText, TextFormat } from "./richText"

/**
 * Block data shared by each block's stories and its feed converter's snapshot
 * test (`src/blocks/<Name>/__tests__/converters.test.ts`), so the web
 * component and the feed HTML are checked against the same content.
 */

export const bannerBlock: BannerBlock = {
  blockType: "banner",
  style: "info",
  content: richText(
    createParagraph([
      createTextNode("Correction: ", TextFormat.Bold),
      createTextNode("an earlier version of this article misstated the turnout in 2022."),
    ]),
  ) as BannerBlock["content"],
}

export const codeBlock: CodeBlock = {
  blockType: "code",
  language: "typescript",
  code: `export function turnout(ballots: number, registered: number): string {
  if (registered === 0) return "n/a"
  return \`\${((ballots / registered) * 100).toFixed(1)}%\`
}`,
}

export const displayMathBlock: DisplayMathBlock = {
  blockType: "displayMathBlock",
  math: "a^2 + b^2 = c^2",
}

export const inlineMathBlock: InlineMathBlock = {
  blockType: "inlineMathBlock",
  math: "E = mc^2",
}

export const footnoteBlock: FootnoteBlock = {
  blockType: "footnote",
  index: 3,
  note: "Turnout figures are from the county clerk's certified results.",
}

/** An article's footnotes field: the notes its footnote blocks point at. */
export const footnotes: NonNullable<FootnotesField> = [
  {
    index: 3,
    note: "Turnout figures are from the county clerk's certified results.",
    attributionEnabled: true,
    link: {
      type: "custom",
      url: "https://example.com/certified-results",
      label: "County Clerk",
    },
  },
  { index: 1, note: "Registration counts as of the close of books.", attributionEnabled: false },
]

/** A map asset from the seed; the stories load its SVG from the static dir. */
export function mapAsset(id: number): MapAsset {
  return {
    id,
    filename: `mo-districts-${id}.svg`,
    mimeType: "image/svg+xml",
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
  }
}

export const interactiveMapBlock: InteractiveMapBlock = {
  blockType: "interactiveMap",
  widgetTitle: "Missouri congressional districts",
  layout: "row",
  colorScale: "divergingRedBlue",
  maps: [{ title: "119th Congress", svgAsset: mapAsset(119), dataAttribute: "data-margin" }],
  sources: [
    {
      link: {
        type: "custom",
        url: "https://www.census.gov/",
        label: "U.S. Census Bureau",
        newTab: true,
      },
    },
  ],
}

/** An image whose caption carries a link, for the media blocks. */
export const captionedImage: Media = mediaFixture({
  caption: richText(
    createParagraph([
      createTextNode("The ridge above town at dusk. Photo: "),
      createLinkNode("County Archive", "https://example.com/archive"),
    ]),
  ) as Media["caption"],
})

export const mediaCollageBlock: MediaCollageBlock = {
  blockType: "mediaCollage",
  layout: "grid",
  images: [captionedImage, squareImage, portraitImage, wideImage].map((media, i) => ({
    id: `img-${i}`,
    media,
  })),
}

export const socialEmbedBlock: SocialEmbedBlock = {
  blockType: "socialEmbed",
  id: "embed-story",
  platform: "twitter",
  url: "https://twitter.com/countyclerk/status/1",
}

export const squiggleRuleBlock: SquiggleRuleBlock = {
  blockType: "squiggleRule",
  variant: "animated",
  size: "medium",
}

export const timelineBlock: TimelineBlock = {
  blockType: "timeline",
  title: "How the district map changed",
  events: [
    {
      date: "2021-11-04T12:00:00.000Z",
      title: "Commission draws the first map",
      description: "The bipartisan commission deadlocks and sends two maps to the legislature.",
      avatar: squareImage,
    },
    {
      date: "2022-02-17T12:00:00.000Z",
      title: "Legislature adopts its own",
      description: "Lawmakers pass a map splitting the county into four districts.",
      enableCitation: true,
      citation: { type: "custom", url: "https://example.com/bill", label: "[1]" },
    },
    {
      date: "2022-06-30T12:00:00.000Z",
      title: "State court strikes it down",
      description: "The court rules the split violates the state constitution's compactness rule.",
      avatar: squareImage,
    },
    {
      date: "2023-01-09T12:00:00.000Z",
      title: "A court-drawn map takes effect",
      description: "The special master's map is used for the 2024 elections.",
    },
  ],
}
