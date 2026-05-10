/**
 * Utility functions for creating Lexical rich text structures
 */

import type {
  SerializedLinkNode,
  SerializedParagraphNode,
  SerializedTextNode,
} from "@payloadcms/richtext-lexical"
import type {
  ElementFormatType,
  SerializedEditorState,
  SerializedElementNode,
  SerializedLexicalNode,
} from "@payloadcms/richtext-lexical/lexical"

// Re-export commonly used types
export type { SerializedLexicalNode }

/**
 * We need to make this to match with payloads generated types.
 */
export type LexicalContent = SerializedEditorState & {
  [k: string]: unknown
}

/**
 * Creates a text node for use within paragraphs
 */
export function createTextNode(text: string, format = 0): SerializedTextNode {
  return {
    detail: 0,
    format,
    mode: "normal",
    style: "",
    text,
    type: "text",
    version: 1,
  }
}

/**
 * Creates a link node for use within paragraphs
 */
export function createLinkNode(text: string, url: string, newTab = false): SerializedLinkNode {
  return {
    children: [createTextNode(text)],
    direction: "ltr" as const,
    fields: {
      linkType: "custom" as const,
      newTab,
      url,
    },
    format: "" as const,
    indent: 0,
    type: "link" as const,
    version: 1,
  }
}

/**
 * Creates a paragraph node containing text
 */
export function createParagraph(
  text: string | SerializedTextNode | (SerializedTextNode | Record<string, unknown>)[],
  format: ElementFormatType = "",
): SerializedParagraphNode {
  const children = Array.isArray(text)
    ? (text as SerializedTextNode[])
    : typeof text === "string"
      ? [createTextNode(text)]
      : [text]

  return {
    children,
    direction: "ltr",
    format,
    indent: 0,
    type: "paragraph",
    version: 1,
    textFormat: 0,
    textStyle: "",
  }
}

/**
 * Creates an empty paragraph node (for line breaks)
 */
export function createEmptyParagraph(): SerializedElementNode {
  return {
    children: [],
    direction: null,
    format: "",
    indent: 0,
    type: "paragraph",
    version: 1,
    textFormat: 0,
  }
}

/**
 * Creates a complete Lexical rich text structure from a single string
 */
export function createRichTextFromString(text: string): LexicalContent {
  return {
    root: {
      children: [createParagraph(text)],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  }
}

/**
 * Alias for createRichTextFromString — creates a single-paragraph rich text block.
 * Used by page seeds for Content block columns.
 */
export const createRichTextContent = createRichTextFromString

/**
 * Creates a complete Lexical rich text structure from an array of paragraphs
 * Automatically adds empty paragraphs between each text paragraph for spacing
 */
export function createRichTextFromParagraphs(
  paragraphs: string[],
  addSpacing = false,
): LexicalContent {
  const children: SerializedLexicalNode[] = []

  paragraphs.forEach((text, index) => {
    children.push(createParagraph(text))
    // Add spacing paragraph between (but not after the last one)
    if (addSpacing && index < paragraphs.length - 1) {
      children.push(createEmptyParagraph())
    }
  })

  return {
    root: {
      children,
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  }
}

/**
 * Creates a complete Lexical rich text structure from paragraph nodes
 * Useful when you need more control over the paragraph structure
 */
export function createRichText(children: SerializedLexicalNode[]): LexicalContent {
  return {
    root: {
      children,
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  }
}

/**
 * Generates Lorem Ipsum sentences
 */
const LOREM_IPSUMS = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur; yee wins.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
] as const

/**
 * Generates a Lorem Ipsum sentence
 */
export function generateLoremIspumSentence(): string {
  return LOREM_IPSUMS[Math.floor(Math.random() * LOREM_IPSUMS.length)]!
}

/**
 * Generates a Lorem Ipsum paragraph with a specified number of sentences
 */
export function generateLoremIpsumParagraph(numberOfSentences: number): string {
  return Array.from({ length: numberOfSentences }, () => generateLoremIspumSentence()).join(" ")
}

/**
 * Generates an array of Lorem Ipsum paragraphs
 */
export function generateLoremIpsumParagraphs(
  numberOfParagraphs: number,
  numberOfSentences = 5,
): string[] {
  return Array.from({ length: numberOfParagraphs }, () =>
    generateLoremIpsumParagraph(numberOfSentences),
  )
}

/**
 * Creates Lorem Ipsum rich text content with spacing between paragraphs
 */
export function createLoremIpsumContent(
  numberOfParagraphs: number,
  numberOfSentences?: number,
): LexicalContent {
  const paragraphs = generateLoremIpsumParagraphs(numberOfParagraphs, numberOfSentences)
  return createRichTextFromParagraphs(paragraphs, true)
}

/**
 * Creates a heading node (h2, h3, or h4)
 */
export function createHeadingNode(
  text: string | SerializedTextNode | (SerializedTextNode | Record<string, unknown>)[],
  tag: "h2" | "h3" | "h4" = "h2",
): SerializedLexicalNode {
  const children = Array.isArray(text)
    ? (text as SerializedTextNode[])
    : typeof text === "string"
      ? [createTextNode(text)]
      : [text]

  const node = {
    children,
    direction: "ltr",
    format: "",
    indent: 0,
    tag,
    type: "heading",
    version: 1,
  }
  return node
}

/**
 * Creates a list item node for use within a list
 */
export function createListItemNode(
  text: string | SerializedTextNode | (SerializedTextNode | Record<string, unknown>)[],
  value = 1,
  checked?: boolean,
): SerializedLexicalNode {
  const children = Array.isArray(text)
    ? (text as SerializedTextNode[])
    : typeof text === "string"
      ? [createTextNode(text)]
      : [text]

  const node = {
    children,
    direction: "ltr",
    format: "",
    indent: 0,
    type: "listitem",
    value,
    version: 1,
    ...(checked !== undefined && { checked }),
  }
  return node
}

/**
 * Creates a list node (bullet, number, or check)
 */
export function createListNode(
  items: SerializedLexicalNode[],
  listType: "bullet" | "number" | "check" = "bullet",
): SerializedLexicalNode {
  const node = {
    children: items,
    direction: "ltr",
    format: "",
    indent: 0,
    listType,
    start: 1,
    tag: listType === "number" ? "ol" : "ul",
    type: "list",
    version: 1,
  }
  return node
}

/**
 * Creates a blockquote node
 */
export function createQuoteNode(
  text: string | SerializedTextNode | (SerializedTextNode | Record<string, unknown>)[],
): SerializedLexicalNode {
  const children = Array.isArray(text)
    ? (text as SerializedTextNode[])
    : typeof text === "string"
      ? [createTextNode(text)]
      : [text]

  const node = {
    children,
    direction: "ltr",
    format: "",
    indent: 0,
    type: "quote",
    version: 1,
  }
  return node
}

/**
 * Creates a horizontal rule node
 */
export function createHorizontalRuleNode(): SerializedLexicalNode {
  const node = {
    type: "horizontalrule",
    version: 1,
  }
  return node
}

/**
 * Creates a media block node
 */
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

/**
 * Text format bit flags for Lexical text nodes
 */
export const TextFormat = {
  Normal: 0,
  Bold: 1,
  Italic: 2,
  Strikethrough: 4,
  Underline: 8,
  Code: 16,
  Subscript: 32,
  Superscript: 64,
} as const

/**
 * Creates a table header cell node (<th>)
 */
export function createTableHeaderNode(text: string): SerializedLexicalNode {
  const node = {
    type: "tablecell",
    version: 1,
    direction: "ltr",
    format: "",
    indent: 0,
    headerState: 1,
    colSpan: 1,
    rowSpan: 1,
    backgroundColor: null,
    children: [createParagraph(text)],
  }
  return node
}

/**
 * Creates a table cell node (<td>)
 */
export function createTableCellNode(text: string): SerializedLexicalNode {
  const node = {
    type: "tablecell",
    version: 1,
    direction: "ltr",
    format: "",
    indent: 0,
    headerState: 0,
    colSpan: 1,
    rowSpan: 1,
    backgroundColor: null,
    children: [createParagraph(text)],
  }
  return node
}

/**
 * Creates a table row node
 */
export function createTableRowNode(cells: SerializedLexicalNode[]): SerializedLexicalNode {
  const node = {
    type: "tablerow",
    version: 1,
    direction: null,
    format: "",
    indent: 0,
    children: cells,
  }
  return node
}

/**
 * Creates a table node
 */
export function createTableNode(rows: SerializedLexicalNode[]): SerializedLexicalNode {
  const node = {
    type: "table",
    version: 1,
    direction: null,
    format: "",
    indent: 0,
    children: rows,
  }
  return node
}
