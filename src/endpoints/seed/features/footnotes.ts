import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"
import { createArticle, validateWriters } from "../articles"
import type { SerializedLexicalNode } from "../richtext"
import { createParagraph, createRichText, createTextNode } from "../richtext"

/**
 * An inline footnote node. Attribution is enabled exactly when a link is
 * supplied — a footnote with attribution turned on but nothing to point at
 * renders an empty citation.
 */
export const createFootnoteInlineBlock = (
  note: string,
  link?: {
    type: "custom" | "reference"
    url?: string
    reference?: { relationTo: "articles"; value: number }
    label: string
    newTab: boolean
  },
): SerializedLexicalNode => {
  const node = {
    type: "inlineBlock",
    fields: {
      blockType: "footnote",
      note,
      attributionEnabled: Boolean(link),
      ...(link ? { link } : {}),
    },
    format: "",
    version: 1,
  }
  return node
}

const createArticleContentWithFootnotes = (referencedArticleId: number) => {
  const children = [
    createParagraph(
      "This article demonstrates the footnotes feature. Footnotes are useful for providing additional context, citations, and references.",
    ),
    createParagraph([
      createTextNode(
        "Academic writing often requires citations to support claims and provide readers with sources for further reading",
      ),
      createFootnoteInlineBlock(
        "This is a basic footnote without attribution. It provides additional context or explanation for the preceding text.",
      ),
      createTextNode(
        ". Footnotes can be inserted anywhere in the text where additional information is needed.",
      ),
    ]),
    createParagraph([
      createTextNode(
        "The footnotes feature also supports attribution links, which can point to external sources or internal references",
      ),
      createFootnoteInlineBlock(
        "This footnote includes an attribution link to demonstrate the full capabilities of the footnotes feature.",
        {
          type: "custom",
          url: "https://en.wikipedia.org/wiki/Footnote",
          label: "Wikipedia - Footnote",
          newTab: true,
        },
      ),
      createTextNode(
        ". This makes it easy to cite sources and provide readers with direct access to referenced materials.",
      ),
    ]),
    createParagraph([
      createTextNode("Multiple footnotes can be used throughout a document"),
      createFootnoteInlineBlock(
        "Footnotes are automatically numbered sequentially as they appear in the document.",
      ),
      createTextNode(
        ", and they are automatically numbered in the order they appear. This makes it easy to reference specific notes when discussing complex topics.",
      ),
    ]),
    createParagraph([
      createTextNode(
        "The footnote system integrates seamlessly with the Lexical rich text editor, allowing authors to insert footnotes inline while writing. Footnotes appear as numbered references in the text",
      ),
      createFootnoteInlineBlock(
        "This is another example footnote with attribution to show how multiple footnotes work together in a single document.",
        {
          type: "custom",
          url: "https://www.lexical.dev/",
          label: "Lexical Editor",
          newTab: true,
        },
      ),
      createTextNode(
        ", and clicking on them scrolls to the full footnote text at the bottom of the article.",
      ),
    ]),
  ]

  if (referencedArticleId) {
    children.push(
      createParagraph([
        createTextNode(
          "Footnotes can also link to internal references, such as other articles in the collection",
        ),
        createFootnoteInlineBlock(
          "This footnote demonstrates a reference link to another article, showing how footnotes can connect related content within the site.",
          {
            type: "reference",
            reference: {
              relationTo: "articles",
              value: referencedArticleId,
            },
            label: "Article 1 - Volume 1",
            newTab: false,
          },
        ),
        createTextNode(
          ". This creates a network of interconnected content that enhances the reading experience.",
        ),
      ]),
    )
  }

  return createRichText(children)
}

export const createFootnotesArticle = async (
  payload: Payload,
  writers: User[],
  mediaDocs: Media[],
  referencedArticleId: number,
  topics: number[] = [],
): Promise<number> => {
  validateWriters(writers)

  const title = "Demonstrating Footnotes: A Comprehensive Guide"

  const article = await createArticle(payload, {
    title,
    content: createArticleContentWithFootnotes(referencedArticleId),
    authors: writers.map((writer) => writer.id),
    topics: topics,
    slug: "demonstrating-footnotes-comprehensive-guide",
    heroImage: mediaDocs[Math.floor(Math.random() * mediaDocs.length)]?.id,
    meta: {
      title,
      description:
        "This article demonstrates the footnotes feature, showing how to add citations, references, and additional context to your articles.",
      image: mediaDocs[0]?.id,
    },
  })

  return article.id
}
