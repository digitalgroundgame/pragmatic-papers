import type { Decorator } from "@storybook/nextjs-vite"
import React from "react"

import type { FeedArticle, FeedArticleSummary, LexicalNode } from "@/app/feed/types"
import type { Form } from "@/payload-types"

import { articleFixture, authors, topics, volumes } from "./docs"
import { wideImage } from "./media"
import {
  createHeadingNode,
  createParagraph,
  createTextNode,
  richText,
  SENTENCES,
  TextFormat,
} from "./richText"

/** A phone-sized frame: every feed view fills its parent, as it does in the feed's scroller. */
export const phoneFrame: Decorator = (Story) => (
  <div className="bg-background h-[720px] w-[390px] overflow-hidden">
    <Story />
  </div>
)

function block(fields: Record<string, unknown>): LexicalNode {
  return { type: "block", version: 2, format: "", fields }
}

function prose(sentences: number): LexicalNode {
  return createParagraph(
    Array.from({ length: sentences }, (_, i) => SENTENCES[i % SENTENCES.length]).join(" "),
  ) as LexicalNode
}

function cell(text: string, headerState = 0): LexicalNode {
  return {
    type: "tablecell",
    version: 1,
    headerState,
    children: [createParagraph(text)],
  }
}

function row(...cells: LexicalNode[]): LexicalNode {
  return { type: "tablerow", version: 1, children: cells }
}

/** A Lexical table with a column-header row and a row-header column. */
export const turnoutTable: LexicalNode = {
  type: "table",
  version: 1,
  children: [
    row(cell("County", 1), cell("2022", 1), cell("2024", 1)),
    row(cell("Adams", 2), cell("18%"), cell("24%")),
    row(cell("Brown", 2), cell("22%"), cell("31%")),
  ],
}

export const mediaBlockNode: LexicalNode = block({ blockType: "mediaBlock", media: wideImage })

export const pitchForm = {
  id: 7,
  title: "Pitch the editors",
  submitButtonLabel: "Send it",
  confirmationType: "message",
  confirmationMessage: richText(createParagraph("Thanks — an editor will reply within two days.")),
  fields: [
    { blockType: "text", name: "name", label: "Name", required: true, width: 100 },
    { blockType: "textarea", name: "pitch", label: "Your pitch", required: true },
  ],
  createdAt: "2026-01-15T12:00:00.000Z",
  updatedAt: "2026-01-15T12:00:00.000Z",
} as Form

export const formBlockNode: LexicalNode = block({ blockType: "formBlock", form: pitchForm })

export const headingNode = createHeadingNode("Turnout by county", "h2") as LexicalNode

/**
 * Hero, two prose pages, then a media page, a table under a heading and a
 * form: one of each page the chunker makes.
 */
export const feedBody: LexicalNode[] = [
  createHeadingNode("Why the small races matter", "h2") as LexicalNode,
  createParagraph([
    createTextNode(`${SENTENCES[0]} `),
    createTextNode("Most of them are decided by a handful of votes.", TextFormat.Bold),
  ]) as LexicalNode,
  ...Array.from({ length: 5 }, () => prose(4)),
  mediaBlockNode,
  headingNode,
  turnoutTable,
  prose(2),
  formBlockNode,
]

export function feedArticle(
  overrides: Partial<FeedArticle> = {},
  children: LexicalNode[] = feedBody,
): FeedArticle {
  const { id, slug, title, heroImage, publishedAt, meta } = articleFixture()
  return {
    id,
    slug,
    title,
    heroImage,
    publishedAt,
    meta,
    enableMathRendering: false,
    authors: [authors[0]!],
    topics: [topics[0]!, topics[1]!],
    volume: { id: volumes[0]!.id, title: volumes[0]!.title, slug: volumes[0]!.slug },
    footnotes: [],
    content: {
      root: {
        type: "root",
        version: 1,
        children,
        direction: "ltr",
        format: "",
        indent: 0,
      },
    } as FeedArticle["content"],
    ...overrides,
  }
}

export function feedSummary(overrides: Partial<FeedArticle> = {}): FeedArticleSummary {
  const { content: _content, footnotes: _footnotes, ...summary } = feedArticle(overrides)
  return summary
}
