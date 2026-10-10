import { bannerToHTML } from "@/blocks/Banner/converters"
import { codeToHTML } from "@/blocks/Code/converters"
import { footnotesToHTML, footnoteToHTML } from "@/blocks/Footnote/converters"
import { interactiveMapToHTML } from "@/blocks/InteractiveMap/converters"
import { displayMathToCode, inlineMathToCode } from "@/blocks/Math/converters"
import { mediaBlockToHTML, mediaToFigure } from "@/blocks/MediaBlock/converters"
import { mediaCollageToHTML } from "@/blocks/MediaCollageBlock/converters"
import { socialEmbedToHTML } from "@/blocks/SocialEmbed/converters"
import { squiggleRuleToHTML } from "@/blocks/SquiggleRule/converters"
import { timelineToHTML } from "@/blocks/Timeline/converters"
import { internalDocToHref } from "@/utilities/routes"
import type { Article, Media, User } from "@/payload-types"
import { escapeHTML, fromBlock, absoluteURL as toAbsoluteURL } from "@/utilities/feedHTML"
import { getServerSideURL } from "@/utilities/getURL"
import { isResolved } from "@/utilities/relationships"
import type {
  SerializedLinkNode,
  SerializedListNode,
  SerializedTableCellNode,
  SerializedTextNode,
  SerializedUploadNode,
} from "@payloadcms/richtext-lexical"
import {
  convertLexicalToHTML,
  LinkHTMLConverter,
  type HTMLConvertersFunction,
} from "@payloadcms/richtext-lexical/html"
import { Feed } from "feed"
import type { SerializedLexicalNode } from "@/utilities/lexical"

/**
 * RSS feed built for Substack's importer (Settings → Import → from URL).
 *
 * Unlike `/articles/feed.xml`, whose HTML targets feed readers, this markup is
 * written for Substack's editor, which keeps only plain semantic HTML: every
 * URL is absolute, there are no inline styles, math falls back to its LaTeX
 * source, footnotes become plain endnotes, and blocks Substack cannot render
 * (interactive maps) link back to the article. Each post ends by pointing at
 * the original on the site.
 */

const SITE_NAME = "The Pragmatic Papers"

const absoluteURL = (url: string): string => toAbsoluteURL(url, getServerSideURL())

export const articleURL = (article: Pick<Article, "slug">): string =>
  absoluteURL(`/articles/${article.slug}`)

// Lexical's text format bits (see `NodeFormat` in @payloadcms/richtext-lexical).
const TEXT_FORMATS: [bit: number, tag: string][] = [
  [1, "strong"],
  [2, "em"],
  [4, "s"],
  [8, "u"],
  [16, "code"],
  [32, "sub"],
  [64, "sup"],
]

/**
 * Plain tags for text formatting. Payload's own converter writes underline and
 * strikethrough as `<span style="text-decoration: …">`, which Substack strips.
 */
const textToHTML = ({ node }: { node: SerializedTextNode }): string =>
  TEXT_FORMATS.reduce(
    (html, [bit, tag]) => (node.format & bit ? `<${tag}>${html}</${tag}>` : html),
    escapeHTML(node.text),
  )

type NodesToHTML = (args: { nodes: SerializedLexicalNode[] }) => string[]

/**
 * Plain `<ol>`/`<ul>` lists. Payload's converter adds empty `class`/`style`
 * attributes to every item and renders checklist items as form inputs with
 * React attribute names (`htmlFor`, `readOnly`); here a checklist item is
 * prefixed with ☑ or ☐ instead. Lexical stores a nested list as its own item
 * holding only that list, so it's attached to the item before it rather than
 * rendered as an empty bullet.
 */
const listToHTML = ({
  node,
  nodesToHTML,
}: {
  node: SerializedListNode
  nodesToHTML: NodesToHTML
}): string => {
  const tag = node.listType === "number" ? "ol" : "ul"
  const start = tag === "ol" && node.start > 1 ? ` start="${node.start}"` : ""
  const items: string[] = []

  for (const item of node.children as {
    children?: SerializedLexicalNode[]
    checked?: boolean
  }[]) {
    const children = item.children ?? []
    const html = nodesToHTML({ nodes: children }).join("")
    const onlyNestedList = children.length > 0 && children.every(({ type }) => type === "list")
    if (onlyNestedList && items.length > 0) {
      items[items.length - 1] += html
      continue
    }
    const box = node.listType === "check" ? (item.checked ? "☑ " : "☐ ") : ""
    items.push(box + html)
  }

  return `<${tag}${start}>${items.map((item) => `<li>${item}</li>`).join("")}</${tag}>`
}

/** A plain table: Payload's adds site-only classes and inline borders to every cell. */
const tableCellToHTML = ({
  node,
  nodesToHTML,
}: {
  node: SerializedTableCellNode
  nodesToHTML: NodesToHTML
}): string => {
  const tag = node.headerState > 0 ? "th" : "td"
  const colSpan = node.colSpan && node.colSpan > 1 ? ` colspan="${node.colSpan}"` : ""
  const rowSpan = node.rowSpan && node.rowSpan > 1 ? ` rowspan="${node.rowSpan}"` : ""
  return `<${tag}${colSpan}${rowSpan}>${nodesToHTML({ nodes: node.children }).join("")}</${tag}>`
}

/**
 * Converters for the Substack feed. `url` is the article's own URL, which
 * internal links fall back to and interactive maps link back to. Covered by
 * `src/utilities/__tests__/generateRssFeed.converters.test.ts`, which fails
 * when a block or node type the article editor allows has no converter here.
 */
export const createSubstackConverters = (url: string): HTMLConvertersFunction => {
  return ({ defaultConverters }) => {
    const context = { siteUrl: getServerSideURL(), pageUrl: url }
    return {
      ...defaultConverters,
      ...LinkHTMLConverter({
        internalDocToHref: ({ linkNode }: { linkNode: SerializedLinkNode }) => {
          try {
            return absoluteURL(internalDocToHref({ linkNode }))
          } catch {
            return url
          }
        },
      }),
      text: textToHTML,
      list: listToHTML,
      listitem: ({ node, nodesToHTML }) =>
        `<li>${nodesToHTML({ nodes: node.children }).join("")}</li>`,
      table: ({ node, nodesToHTML }) =>
        `<table>${nodesToHTML({ nodes: node.children }).join("")}</table>`,
      tablerow: ({ node, nodesToHTML }) =>
        `<tr>${nodesToHTML({ nodes: node.children }).join("")}</tr>`,
      tablecell: tableCellToHTML,
      upload: ({ node, nodesToHTML }: { node: SerializedUploadNode; nodesToHTML: NodesToHTML }) => {
        const upload = typeof node.value === "object" ? (node.value as Media) : null
        if (!upload?.mimeType?.startsWith("image")) return ""
        return mediaToFigure(upload, {
          ...context,
          richTextToHTML: (data) => nodesToHTML({ nodes: data.root.children }).join(""),
        })
      },
      // Drop anything without a converter instead of printing "unknown node".
      unknown: () => "",
      // Each block renders through its own `src/blocks/<Name>/converters.ts`;
      // this picks the format Substack's editor keeps.
      blocks: {
        ...defaultConverters.blocks,
        banner: fromBlock(bannerToHTML, context),
        code: fromBlock(codeToHTML, context),
        displayMathBlock: fromBlock(displayMathToCode, context),
        interactiveMap: fromBlock(interactiveMapToHTML, context),
        mediaBlock: fromBlock(mediaBlockToHTML, context),
        mediaCollage: fromBlock(mediaCollageToHTML, context),
        squiggleRule: fromBlock(squiggleRuleToHTML, context),
        socialEmbed: fromBlock(socialEmbedToHTML, context),
        blueSkyEmbed: fromBlock(socialEmbedToHTML, context),
        redditEmbed: fromBlock(socialEmbedToHTML, context),
        tiktokEmbed: fromBlock(socialEmbedToHTML, context),
        twitterEmbed: fromBlock(socialEmbedToHTML, context),
        youtubeEmbed: fromBlock(socialEmbedToHTML, context),
        timeline: fromBlock(timelineToHTML, context),
      },
      inlineBlocks: {
        ...defaultConverters.inlineBlocks,
        inlineMathBlock: fromBlock(inlineMathToCode, context),
        footnote: fromBlock(footnoteToHTML, context),
      },
    }
  }
}

export const substackArticleHTML = (article: Article): string => {
  const url = articleURL(article)
  const options = { disableContainer: true, disableIndent: true, disableTextAlign: true }
  const hero = mediaToFigure(article.heroImage, {
    siteUrl: getServerSideURL(),
    richTextToHTML: (data) =>
      convertLexicalToHTML({
        data: data as Article["content"],
        converters: createSubstackConverters(url),
        ...options,
      }),
  })
  const body = convertLexicalToHTML({
    data: article.content,
    converters: createSubstackConverters(url),
    ...options,
  })
  const notes = footnotesToHTML(article.footnotes, { siteUrl: getServerSideURL() })
  const footer = `<hr /><p><em>Originally published at <a href="${escapeHTML(url)}">${SITE_NAME}</a>.</em></p>`

  return hero + body + notes + footer
}

export const generateSubstackFeed = (articles: Article[]): string => {
  const siteURL = getServerSideURL()
  const feed = new Feed({
    title: SITE_NAME,
    description: `Articles from ${SITE_NAME}, formatted for import into Substack`,
    id: siteURL,
    link: siteURL,
    language: "en",
    favicon: `${siteURL}/favicon.ico`,
    copyright: `All rights reserved ${new Date().getFullYear()}`,
    generator: SITE_NAME,
    updated: new Date(),
    feedLinks: { rss: `${siteURL}/articles/substack.xml` },
  })

  for (const article of articles) {
    if (article._status !== "published" || !article.publishedAt) continue

    const url = articleURL(article)
    let content = ""
    try {
      content = substackArticleHTML(article)
    } catch (error) {
      console.error(`Error converting article ${article.slug} for Substack:`, error)
      continue
    }

    feed.addItem({
      title: article.title,
      id: url,
      link: url,
      date: new Date(article.publishedAt),
      published: new Date(article.publishedAt),
      description: article.meta?.description ?? "",
      author: (article.authors ?? []).filter(isResolved<User>).map((author) => ({
        name: author.name ?? "",
      })),
      content,
    })
  }

  return feed.rss2()
}
