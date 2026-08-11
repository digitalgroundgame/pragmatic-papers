export {
  createEmptyParagraph,
  createHeadingNode,
  createHorizontalRuleNode,
  createLinkNode,
  createListItemNode,
  createListNode,
  createParagraph,
  createQuoteNode,
  createRichText,
  createRichTextContent,
  createRichTextFromParagraphs,
  createRichTextFromString,
  createTableCellNode,
  createTableHeaderNode,
  createTableNode,
  createTableRowNode,
  createTextNode,
  TextFormat,
} from "@/utilities/lexical"
export type { LexicalContent, SerializedLexicalNode } from "@/utilities/lexical"

import type { LexicalContent, SerializedLexicalNode } from "@/utilities/lexical"
import { createRichTextFromParagraphs } from "@/utilities/lexical"

const LOREM_IPSUMS = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur; yee wins.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
] as const

export function generateLoremIspumSentence(): string {
  return LOREM_IPSUMS[Math.floor(Math.random() * LOREM_IPSUMS.length)]!
}

export function generateLoremIpsumParagraph(numberOfSentences: number): string {
  return Array.from({ length: numberOfSentences }, () => generateLoremIspumSentence()).join(" ")
}

export function generateLoremIpsumParagraphs(
  numberOfParagraphs: number,
  numberOfSentences = 5,
): string[] {
  return Array.from({ length: numberOfParagraphs }, () =>
    generateLoremIpsumParagraph(numberOfSentences),
  )
}

export function createLoremIpsumContent(
  numberOfParagraphs: number,
  numberOfSentences?: number,
): LexicalContent {
  const paragraphs = generateLoremIpsumParagraphs(numberOfParagraphs, numberOfSentences)
  return createRichTextFromParagraphs(paragraphs, true)
}

export function createMediaBlockNode(mediaId: number): SerializedLexicalNode {
  const node = {
    type: "block",
    fields: {
      blockType: "mediaBlock",
      media: mediaId,
    },
    format: "",
    version: 2,
  }
  return node
}

export function createNewsletterSignupBlockNode(fields?: {
  heading?: string
  description?: string
  buttonLabel?: string
  notice?: LexicalContent
}): SerializedLexicalNode {
  const node = {
    type: "block",
    fields: {
      blockType: "newsletterSignup",
      ...fields,
    },
    format: "",
    version: 2,
  }
  return node
}

export function createMerchBlockNode(fields: {
  heading?: string
  layout?: "square" | "fullWidth"
  autoplay?: boolean
  storeUrl?: string
  source?: "all" | "filtered"
  featuredOnly?: boolean
  shopifyCollection?: string
  tag?: string
  selectedProducts?: number[]
  orderBy?: "sortOrder" | "title" | "newest"
  limit?: number
}): SerializedLexicalNode {
  const node = {
    type: "block",
    fields: {
      blockType: "merch",
      ...fields,
    },
    format: "",
    version: 2,
  }
  return node
}

export function createCTABlockNode(fields: {
  richText: LexicalContent
  links?: Array<{
    id?: string
    link: {
      type?: "custom" | "reference"
      url?: string | null
      label?: string | null
      newTab?: boolean | null
      appearance?: "default" | "outline"
    }
  }>
}): SerializedLexicalNode {
  const node = {
    type: "block",
    fields: {
      blockType: "cta",
      ...fields,
    },
    format: "",
    version: 2,
  }
  return node
}
