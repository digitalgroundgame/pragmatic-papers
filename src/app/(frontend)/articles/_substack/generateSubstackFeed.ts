import { socialEmbedBlockToHTML } from "@/blocks/SocialEmbed/helpers/socialEmbedBlockToHTML"
import { internalDocToHref } from "@/components/RichText/internalDocToHref"
import type {
  Article,
  BannerBlock,
  CodeBlock,
  DisplayMathBlock,
  FootnoteBlock,
  InlineMathBlock,
  InteractiveMapBlock,
  Media,
  MediaBlock,
  MediaCollageBlock,
  TimelineBlock,
  User,
} from "@/payload-types"
import { getLinkFieldUrl } from "@/utilities/getLinkFieldUrl"
import { escapeHTML, absoluteURL as toAbsoluteURL } from "@/utilities/feedHTML"
import { getServerSideURL } from "@/utilities/getURL"
import { isResolved } from "@/utilities/relationships"
import type {
  SerializedBlockNode,
  SerializedInlineBlockNode,
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
 * Unlike `/feed.articles`, whose HTML targets feed readers, this markup is
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

const figureHTML = (media: number | Media | null | undefined): string => {
  if (!media || typeof media !== "object" || !media.url) return ""
  const caption = media.caption
    ? convertLexicalToHTML({ data: media.caption, disableContainer: true })
    : ""
  return `<figure><img src="${escapeHTML(absoluteURL(media.url))}" alt="${escapeHTML(media.alt ?? "")}" />${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`
}

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
      upload: ({ node }: { node: SerializedUploadNode }) => {
        const upload = typeof node.value === "object" ? (node.value as Media) : null
        return upload?.mimeType?.startsWith("image") ? figureHTML(upload) : ""
      },
      // Drop anything without a converter instead of printing "unknown node".
      unknown: () => "",
      blocks: {
        ...defaultConverters.blocks,
        banner: ({
          node,
          nodesToHTML,
        }: {
          node: SerializedBlockNode<BannerBlock>
          nodesToHTML: (args: { nodes: SerializedLexicalNode[] }) => string[]
        }) =>
          `<blockquote>${nodesToHTML({ nodes: node.fields.content.root.children }).join("")}</blockquote>`,
        code: ({ node }: { node: SerializedBlockNode<CodeBlock> }) =>
          `<pre><code>${escapeHTML(node.fields.code ?? "")}</code></pre>`,
        displayMathBlock: ({ node }: { node: SerializedBlockNode<DisplayMathBlock> }) =>
          node.fields.math ? `<pre><code>${escapeHTML(node.fields.math)}</code></pre>` : "",
        interactiveMap: ({ node }: { node: SerializedBlockNode<InteractiveMapBlock> }) => {
          const title = node.fields.widgetTitle ? `“${escapeHTML(node.fields.widgetTitle)}” ` : ""
          return `<p><a href="${escapeHTML(url)}">View the interactive map ${title}on ${SITE_NAME} →</a></p>`
        },
        mediaBlock: ({ node }: { node: SerializedBlockNode<MediaBlock> }) =>
          figureHTML(node.fields.media),
        mediaCollage: ({ node }: { node: SerializedBlockNode<MediaCollageBlock> }) =>
          node.fields.images.map(({ media }) => figureHTML(media)).join(""),
        squiggleRule: "<hr />",
        socialEmbed: socialEmbedBlockToHTML,
        blueSkyEmbed: socialEmbedBlockToHTML,
        redditEmbed: socialEmbedBlockToHTML,
        tiktokEmbed: socialEmbedBlockToHTML,
        twitterEmbed: socialEmbedBlockToHTML,
        youtubeEmbed: socialEmbedBlockToHTML,
        timeline: ({ node }: { node: SerializedBlockNode<TimelineBlock> }) => {
          const { title, events } = node.fields
          if (!events?.length) return ""
          const items = events
            .map((event) => {
              const citation = event.enableCitation ? getLinkFieldUrl(event.citation) : null
              return [
                `<li><strong>${escapeHTML(event.date)}</strong>`,
                event.title ? ` — <strong>${escapeHTML(event.title)}</strong>` : "",
                `<br />${escapeHTML(event.description ?? "")}`,
                citation ? ` <a href="${escapeHTML(absoluteURL(citation))}">[source]</a>` : "",
                "</li>",
              ].join("")
            })
            .join("")
          return `${title ? `<h3>${escapeHTML(title)}</h3>` : ""}<ul>${items}</ul>`
        },
      },
      inlineBlocks: {
        ...defaultConverters.inlineBlocks,
        inlineMathBlock: ({ node }: { node: SerializedInlineBlockNode }) =>
          `<code>${escapeHTML((node.fields as InlineMathBlock).math ?? "")}</code>`,
        footnote: ({ node }: { node: SerializedInlineBlockNode }) => {
          const { index } = node.fields as FootnoteBlock
          return typeof index === "number" ? `<sup>[${index}]</sup>` : ""
        },
      },
    }
  }
}

const notesHTML = (footnotes: Article["footnotes"]): string => {
  const items = (footnotes ?? [])
    .filter((footnote) => footnote?.note && typeof footnote.index === "number")
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map(({ index, note, attributionEnabled, link }) => {
      const source = attributionEnabled ? getLinkFieldUrl(link) : null
      const sourceHTML = source
        ? ` <a href="${escapeHTML(absoluteURL(source))}">${escapeHTML(link?.label || absoluteURL(source))}</a>`
        : ""
      return `<p>[${index}] ${escapeHTML(note)}${sourceHTML}</p>`
    })
    .join("")

  return items ? `<hr /><h3>Notes</h3>${items}` : ""
}

export const substackArticleHTML = (article: Article): string => {
  const url = articleURL(article)
  const hero = figureHTML(article.heroImage)
  const body = convertLexicalToHTML({
    data: article.content,
    converters: createSubstackConverters(url),
    disableContainer: true,
    disableIndent: true,
    disableTextAlign: true,
  })
  const footer = `<hr /><p><em>Originally published at <a href="${escapeHTML(url)}">${SITE_NAME}</a>.</em></p>`

  return hero + body + notesHTML(article.footnotes) + footer
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
