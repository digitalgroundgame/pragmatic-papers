import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"

import { createArticle, validateWriters } from "../articles"
import { createMapAssetFromFixture } from "../mapAssets"
import {
  createHeadingNode,
  createListItemNode,
  createListNode,
  createMediaBlockNode,
  createParagraph,
  createRichText,
  createTableCellNode,
  createTableHeaderNode,
  createTableNode,
  createTableRowNode,
  generateLoremIpsumParagraph,
} from "../richtext"
import { createCodeBlock } from "./code-blocks"
import { createInteractiveMapNode } from "./interactive-maps"
import { createMediaCollageBlock } from "./media-collage"
import { createSocialEmbedBlock, SOCIAL_MEDIA_URLS } from "./social-embeds"
import { createTimelineBlock } from "./timeline"

const filler = () => createParagraph(generateLoremIpsumParagraph(5))

/**
 * Exercises every path through the table of contents: the Intro entry, h2–h4
 * nesting, deduplicated anchors, each block with an icon, and blocks that stay
 * out of the list.
 */
export const createTableOfContentsArticle = async (
  payload: Payload,
  writers: User[],
  mediaDocs: Media[],
  topics: number[] = [],
  context?: Record<string, unknown>,
): Promise<number> => {
  validateWriters(writers)
  if (mediaDocs.length < 4) {
    throw new Error("createTableOfContentsArticle requires at least four media documents")
  }

  const mapAsset = await createMapAssetFromFixture(
    payload,
    "mo-districts-120.svg",
    "Missouri Congressional Districts — 120th Congress",
    "https://cdmaps.polisci.ucla.edu/",
  )
  const youtube = SOCIAL_MEDIA_URLS.find((item) => item.platform === "youtube")!

  const title = "Finding Your Way: A Tour of the Table of Contents"

  const article = await createArticle(
    payload,
    {
      title,
      slug: "finding-your-way-table-of-contents",
      showTableOfContents: true,
      authors: writers.map((writer) => writer.id),
      topics,
      heroImage: mediaDocs[3]!.id,
      meta: {
        title,
        description:
          "Every heading and block the table of contents can list, in one article: nesting, repeated headings, tables, maps, timelines, galleries and embeds.",
        image: mediaDocs[3]!.id,
      },
      content: createRichText([
        createParagraph(
          "This article opens with a paragraph rather than a heading, so the table of contents starts with an Intro entry that jumps back to the top. Tick Show table of contents in an article's sidebar to add the list beside the body and a toggle to the hero.",
        ),
        filler(),

        createHeadingNode("How entries are built", "h2"),
        createParagraph(
          "Each save walks the article once and stamps an anchor on every heading, table and listed block. The links in the list and the ids on the page both read that anchor, so they always agree.",
        ),
        createHeadingNode("Headings set the depth", "h3"),
        createParagraph(
          "A second-level heading starts a top-level entry. Third- and fourth-level headings nest beneath the heading before them.",
        ),
        createHeadingNode("A fourth-level heading", "h4"),
        createParagraph("This entry sits two levels deep in the list."),
        filler(),
        createHeadingNode("In practice", "h3"),
        createParagraph(
          "This heading's text appears again later in the article. The first one is linked as #in-practice and the second as #in-practice-2, so both links land in the right place.",
        ),
        filler(),

        createHeadingNode("Blocks that earn an entry", "h2"),
        createParagraph(
          "Some blocks are worth jumping to on their own. They appear in the list with an icon, labelled by their own title where they have one, and nest under the heading before them.",
        ),
        createParagraph("Tables are numbered in document order: table-1, table-2 and so on."),
        createTableNode([
          createTableRowNode([
            createTableHeaderNode("Block"),
            createTableHeaderNode("Listed as"),
            createTableHeaderNode("Icon"),
          ]),
          createTableRowNode([
            createTableCellNode("Table"),
            createTableCellNode("Table"),
            createTableCellNode("Grid"),
          ]),
          createTableRowNode([
            createTableCellNode("Interactive map"),
            createTableCellNode("Its widget or map title, else Map"),
            createTableCellNode("Map"),
          ]),
          createTableRowNode([
            createTableCellNode("Timeline"),
            createTableCellNode("Its title, else Timeline"),
            createTableCellNode("Gantt chart"),
          ]),
          createTableRowNode([
            createTableCellNode("Gallery"),
            createTableCellNode("Gallery"),
            createTableCellNode("Images"),
          ]),
          createTableRowNode([
            createTableCellNode("Social embed"),
            createTableCellNode("Platform embed, e.g. YouTube embed"),
            createTableCellNode("Screen"),
          ]),
        ]),
        createParagraph(
          "An interactive map is listed under its widget title. A single map with no widget title uses the map's own title instead.",
        ),
        createInteractiveMapNode(
          [{ title: "120th Congress", svgAssetId: mapAsset.id, dataAttribute: "data-margin" }],
          "Missouri's 120th Congress margins",
        ),
        createParagraph("A timeline is listed under its title."),
        createTimelineBlock(
          [
            {
              date: "2026-09-01",
              title: "Draft saved",
              description: "Saving stamps an anchor on each heading, table and listed block.",
            },
            {
              date: "2026-09-02",
              title: "Preview checked",
              description: "The admin sidebar previews the list as you type, before the next save.",
            },
            {
              date: "2026-09-03",
              title: "Published",
              description: "Readers get the sticky list beside the body and a toggle in the hero.",
            },
          ],
          "An article's path to publication",
        ),
        createParagraph("A gallery has no title of its own, so every one is listed as Gallery."),
        createMediaCollageBlock([mediaDocs[0]!.id, mediaDocs[1]!.id, mediaDocs[2]!.id]),
        createParagraph("A social embed is listed under its platform."),
        createSocialEmbedBlock({ ...youtube, id: "seed-toc-socialEmbed-youtube" }),
        createHeadingNode("In practice", "h3"),
        createParagraph(
          "This is the repeated heading from earlier. It links as #in-practice-2 and highlights on its own as you scroll past it.",
        ),
        filler(),

        createHeadingNode("What stays out", "h2"),
        createParagraph(
          "Blocks without a title, and blocks that tend to repeat, are left out so the list stays short. This section holds one of each, and none of them appear in the table of contents.",
        ),
        createListNode([
          createListItemNode("A single image", 1),
          createListItemNode("A code block", 2),
        ]),
        createMediaBlockNode(mediaDocs[3]!.id),
        createCodeBlock(
          "typescript",
          'const anchor = slugify("What stays out") // "what-stays-out"',
        ),

        createHeadingNode("Reading along", "h2"),
        createParagraph(
          "As you scroll, the entry for the section in view is underlined. Hover a heading to reveal its link icon and copy a link straight to it. The toggle in the hero collapses the list and gives the body back its width.",
        ),
        filler(),
        filler(),
      ]),
    },
    context,
  )

  return article.id
}
