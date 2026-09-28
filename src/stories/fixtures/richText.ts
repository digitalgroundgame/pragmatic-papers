import {
  createHeadingNode,
  createLinkNode,
  createListItemNode,
  createListNode,
  createParagraph,
  createQuoteNode,
  createRichText,
  createTextNode,
  type LexicalContent,
  type SerializedLexicalNode,
  TextFormat,
} from "@/utilities/lexical"

export {
  createHeadingNode,
  createLinkNode,
  createListItemNode,
  createListNode,
  createParagraph,
  createQuoteNode,
  createRichText,
  createTextNode,
  TextFormat,
}

export const SENTENCES = [
  "Local elections decide more about daily life than the races that dominate the news.",
  "Turnout in off-year contests routinely falls below a quarter of registered voters.",
  "Zoning boards, school boards, and county commissions set the rules most people live under.",
  "A few hundred votes can swing a city council seat, and with it a housing budget.",
] as const

export function paragraphs(count: number): LexicalContent {
  return createRichText(
    Array.from({ length: count }, (_, i) => createParagraph(SENTENCES[i % SENTENCES.length]!)),
  )
}

export function richText(...children: SerializedLexicalNode[]): LexicalContent {
  return createRichText(children)
}

export const articleBody: LexicalContent = richText(
  createHeadingNode("Why the small races matter", "h2"),
  createParagraph([
    createTextNode(`${SENTENCES[0]} `),
    createTextNode("Most of them are decided by a handful of votes.", TextFormat.Bold),
  ]),
  createParagraph([
    createTextNode("Read the "),
    createLinkNode("full turnout report", "https://example.com/report"),
    createTextNode(" for the county-by-county numbers."),
  ]),
  createQuoteNode("All politics is local."),
  createListNode([
    createListItemNode("School boards", 1),
    createListItemNode("County commissions", 2),
    createListItemNode("City councils", 3),
  ]),
)
