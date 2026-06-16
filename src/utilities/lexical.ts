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

export type { SerializedLexicalNode }

export type LexicalContent = SerializedEditorState & {
  [k: string]: unknown
}

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

export function createRichTextFromString(text: string): LexicalContent {
  return createRichText([createParagraph(text)])
}

export const createRichTextContent = createRichTextFromString

export function createRichTextFromParagraphs(
  paragraphs: string[],
  addSpacing = false,
): LexicalContent {
  const children: SerializedLexicalNode[] = []
  paragraphs.forEach((text, index) => {
    children.push(createParagraph(text))
    if (addSpacing && index < paragraphs.length - 1) {
      children.push(createEmptyParagraph())
    }
  })
  return createRichText(children)
}

export function createHeadingNode(
  text: string | SerializedTextNode | (SerializedTextNode | Record<string, unknown>)[],
  tag: "h1" | "h2" | "h3" | "h4" = "h2",
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

export function createHorizontalRuleNode(): SerializedLexicalNode {
  return { type: "horizontalrule", version: 1 }
}

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
