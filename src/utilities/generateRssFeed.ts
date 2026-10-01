import { socialEmbedBlockToHTML } from "@/blocks/SocialEmbed/helpers/socialEmbedBlockToHTML"
import { internalDocToHref } from "@/components/RichText/internalDocToHref"
import { isResolved } from "@/utilities/relationships"
import type {
  Article,
  BannerBlock,
  CodeBlock,
  DisplayMathBlock,
  FootnoteBlock,
  InteractiveMapBlock,
  Media,
  MediaBlock,
  MediaCollageBlock,
  TimelineBlock,
  User,
  Volume,
} from "@/payload-types"
import type {
  SerializedBlockNode,
  SerializedInlineBlockNode,
  SerializedLinkNode,
} from "@payloadcms/richtext-lexical"
import {
  convertLexicalToHTML,
  LinkHTMLConverter,
  type HTMLConvertersFunction,
} from "@payloadcms/richtext-lexical/html"
import { Feed } from "feed"
import { absoluteURL, escapeHTML } from "./feedHTML"
import { getServerSideURL } from "./getURL"
import type { SerializedLexicalNode } from "./lexical"

// Read on each call, not at import: SERVER_URL is a runtime variable (#1090).
const siteUrl = (): string => getServerSideURL()

const getMediaUrl = (url: string) => {
  const absolute =
    url.startsWith("http://") || url.startsWith("https://") ? url : `${siteUrl()}${url}`
  try {
    return new URL(absolute).href
  } catch {
    return absolute
  }
}

const resolveMedia = (media: number | Media): Media | null =>
  typeof media === "object" ? media : null

const mediaBlockToHTML = ({ node }: { node: SerializedBlockNode<MediaBlock> }): string => {
  const media = resolveMedia(node.fields.media)
  if (!media?.url) return ""
  const src = escapeHTML(getMediaUrl(media.url))
  const alt = escapeHTML(media.alt)
  const widthAttr = media.width ? ` width="${media.width}"` : ""
  const heightAttr = media.height ? ` height="${media.height}"` : ""
  return `<figure><img src="${src}" alt="${alt}"${widthAttr}${heightAttr} style="max-width:100%;height:auto;" /></figure>`
}

const mediaCollageBlockToHTML = ({
  node,
}: {
  node: SerializedBlockNode<MediaCollageBlock>
}): string => {
  const imgs = node.fields.images
    .map(({ media }) => {
      const resolved = resolveMedia(media)
      if (!resolved?.url) return ""
      const src = escapeHTML(getMediaUrl(resolved.url))
      const alt = escapeHTML(resolved.alt)
      return `<img src="${src}" alt="${alt}" style="max-width:100%;height:auto;" />`
    })
    .filter(Boolean)
    .join("\n")
  return imgs ? `<figure style="display:flex;flex-wrap:wrap;gap:0.5em;">${imgs}</figure>` : ""
}

function displayMathBlockToHTML({ node }: { node: SerializedBlockNode<DisplayMathBlock> }): string {
  const { math } = node.fields
  if (!math) return ""
  return `<p class="math display-math">\\[${escapeHTML(math)}\\]</p>`
}

const timelineBlockToHTML = ({ node }: { node: SerializedBlockNode<TimelineBlock> }): string => {
  const { title, events } = node.fields
  if (!events?.length) return ""

  const items = events
    .map((event) => {
      const link = event.enableCitation ? event.citation : undefined
      let citationHtml = ""
      if (link?.url) {
        const href =
          link.type === "reference" &&
          typeof link.reference?.value === "object" &&
          link.reference.value?.slug
            ? `${siteUrl()}/${link.reference.relationTo}/${link.reference.value.slug}`
            : link.url
        citationHtml = ` <a href="${escapeHTML(href)}">[1]</a>`
      }
      const titleHtml = event.title ? ` — <strong>${escapeHTML(event.title)}</strong>` : ""
      return `<li><strong>${escapeHTML(event.date)}</strong>${titleHtml}<br/>${escapeHTML(event.description)}${citationHtml}</li>`
    })
    .join("\n")

  const heading = title ? `<h3>${escapeHTML(title)}</h3>` : ""
  return `<section>${heading}<ul style="list-style: none; padding-left: 0;">${items}</ul></section>`
}

const bannerBlockToHTML = ({
  node,
  nodesToHTML,
}: {
  node: SerializedBlockNode<BannerBlock>
  nodesToHTML: (args: { nodes: SerializedLexicalNode[] }) => string[]
}): string =>
  `<blockquote>${nodesToHTML({ nodes: node.fields.content.root.children }).join("")}</blockquote>`

const codeBlockToHTML = ({ node }: { node: SerializedBlockNode<CodeBlock> }): string =>
  node.fields.code ? `<pre><code>${escapeHTML(node.fields.code)}</code></pre>` : ""

/**
 * Converters for the feeds' rich text. Every node type and block a
 * feed-rendered field allows needs an entry here, or the feed prints "unknown
 * node" in its place; `__tests__/generateRssFeed.converters.test.ts` enforces
 * that against the resolved Payload config.
 *
 * `pageUrl` is the page the content lives on, which blocks a feed reader
 * cannot show (interactive maps) link back to, and which an internal link
 * whose document can't be resolved falls back to.
 */
export const createHtmlConverters =
  (pageUrl: string): HTMLConvertersFunction =>
  ({ defaultConverters }) => ({
    ...defaultConverters,
    // Payload's default link converter has no `internalDocToHref`, so every
    // internal link would render as `href="#"` (#1023). Feed readers need
    // absolute URLs; the site's helper returns a path.
    ...LinkHTMLConverter({
      internalDocToHref: ({ linkNode }: { linkNode: SerializedLinkNode }) => {
        try {
          return absoluteURL(internalDocToHref({ linkNode }), siteUrl())
        } catch {
          return pageUrl
        }
      },
    }),
    // Last resort for anything that slips past the converter test: keep an
    // unknown element's text rather than printing "unknown node", and drop a
    // childless node (a block). It has to be a function: "" is ignored.
    unknown: ({ node, nodesToHTML }) => {
      const { children } = node as { children?: Parameters<typeof nodesToHTML>[0]["nodes"] }
      return children?.length ? nodesToHTML({ nodes: children }).join("") : ""
    },
    blocks: {
      ...defaultConverters.blocks,
      banner: bannerBlockToHTML,
      code: codeBlockToHTML,
      squiggleRule: "<hr />",
      interactiveMap: ({ node }: { node: SerializedBlockNode<InteractiveMapBlock> }) => {
        const title = node.fields.widgetTitle ? ` “${escapeHTML(node.fields.widgetTitle)}”` : ""
        return `<p><a href="${escapeHTML(pageUrl)}">View the interactive map${title} on The Pragmatic Papers</a></p>`
      },
      mediaBlock: mediaBlockToHTML,
      mediaCollage: mediaCollageBlockToHTML,
      socialEmbed: socialEmbedBlockToHTML,
      blueSkyEmbed: socialEmbedBlockToHTML,
      redditEmbed: socialEmbedBlockToHTML,
      tiktokEmbed: socialEmbedBlockToHTML,
      twitterEmbed: socialEmbedBlockToHTML,
      youtubeEmbed: socialEmbedBlockToHTML,
      displayMathBlock: displayMathBlockToHTML,
      timeline: timelineBlockToHTML,
    },
    inlineBlocks: {
      ...defaultConverters.inlineBlocks,
      inlineMathBlock: ({ node }: { node: SerializedInlineBlockNode }) => {
        const math = (node.fields as { math?: string })?.math || ""
        return `<span class="math">\\(${escapeHTML(math)}\\)</span>`
      },
      footnote: ({ node }: { node: SerializedInlineBlockNode }) => {
        const fields = node.fields as FootnoteBlock
        const index = typeof fields.index === "number" ? fields.index : ""
        const note = escapeHTML(fields.note)
        const referenceId = `footnote-ref-${index}`
        const describedById = `footnote-${index}`
        return `<sup id="${referenceId}" title="Footnote ${index}: ${note}"><a href="#${describedById}">[${index}]</a></sup>`
      },
    },
  })

const formatFootnotes = (footnotes?: Article["footnotes"]): string => {
  if (!footnotes || !footnotes.length) return ""

  const footnoteItems = footnotes
    .map((footnote) => {
      if (!footnote) return ""
      const { index, note, attributionEnabled, link } = footnote
      if (!note || typeof index !== "number") return ""

      const describedById = `footnote-${index}`
      let linkHtml = ""

      if (attributionEnabled && link?.url) {
        if (link.type === "custom") {
          linkHtml = ` <a href="${escapeHTML(link.url)}" style="border: none; color: #0066cc; text-decoration: underline;" title="Link to source ${escapeHTML(link.label)}">${escapeHTML(link.url)}</a>`
        } else if (link.type === "reference" && link.reference) {
          const referenceUrl =
            typeof link.reference.value === "object" && link.reference.value?.slug
              ? `${siteUrl()}/${link.reference.relationTo}/${link.reference.value.slug}`
              : link.url
          linkHtml = ` <a href="${escapeHTML(referenceUrl)}" style="border: none; color: #0066cc; text-decoration: underline;" title="Link to source ${escapeHTML(link.label)}">${escapeHTML(link.url)}</a>`
        }
      }

      return `<li><span id="${describedById}">${escapeHTML(note)}</span>${linkHtml}</li>`
    })
    .filter(Boolean)
    .join("\n    ")

  if (!footnoteItems) return ""

  return `<section style="margin-top: 2em; padding-top: 1em; border-top: 1px solid #ddd;"><h3 style="font-size: 1.2em; font-weight: bold; margin-bottom: 0.5em;">Footnotes</h3><ol style="list-style: decimal; padding-left: 1.5em;">${footnoteItems}</ol></section>`
}

const formatArticleLink = (article: Article) => {
  const href = escapeHTML(`${siteUrl()}/articles/${article.slug}`)
  const title = escapeHTML(article.title)
  if (!article.meta?.description) {
    return `<li style="margin: 1em 0"><a href="${href}">${title}</a></li>`
  }

  return `
<li style="margin: 1em 0">
  <a href="${href}">${title}</a>
  <p style="margin: 0.5em 0 0 0; color: #666">${escapeHTML(article.meta.description)}</p>
</li>`
}

const formatVolumeContent = (volume: Volume) => {
  const sections = []

  if (volume.description) {
    sections.push(`<div style="margin-bottom: 1.5em">${escapeHTML(volume.description)}</div>`)
  }

  if (volume.editorsNote) {
    sections.push(`
<div style="margin: 1.5em 0">
  ${convertLexicalToHTML({
    data: volume.editorsNote,
    converters: createHtmlConverters(`${siteUrl()}/volumes/${volume.slug}`),
  })}
</div>`)
  }

  const articles = volume.articles
    ?.map((articleRef) => {
      if (typeof articleRef === "string") return ""
      return formatArticleLink(articleRef as Article)
    })
    .filter(Boolean)
    .join("\n")

  if (articles) {
    sections.push(`
<div style="margin-top: 1.5em">
  <h3>Articles in this Volume</h3>
  <ul style="padding-left: 1.5em">
    ${articles}
  </ul>
</div>`)
  }

  return sections.join("\n")
}

const createBaseFeedConfig = (type: "Articles" | "Volumes") => ({
  title: `The Pragmatic Papers - ${type}`,
  description: `Latest ${type.toLowerCase()} from The Pragmatic Papers`,
  id: siteUrl(),
  link: siteUrl(),
  language: "en",
  favicon: `${siteUrl()}/favicon.ico`,
  copyright: `All rights reserved ${new Date().getFullYear()}`,
  generator: "The Pragmatic Papers",
  updated: new Date(),
  feedLinks: {
    atom: `${siteUrl()}/${type.toLowerCase()}/feed.xml`,
  },
})

export const generateArticleFeed = (articles: Article[]): string => {
  const feed = new Feed(createBaseFeedConfig("Articles"))

  articles.forEach((article) => {
    if (article._status === "published" && article.publishedAt) {
      feed.addItem({
        title: article.title,
        id: `${siteUrl()}/articles/${article.slug}`,
        link: `${siteUrl()}/articles/${article.slug}`,
        published: new Date(article.publishedAt),
        description: article.meta?.description ? article.meta.description : "",
        date: new Date(article.publishedAt),
        image:
          article.meta?.image && typeof article.meta.image !== "string"
            ? getMediaUrl((article.meta.image as Media).url ?? "")
            : undefined,
        author: (article.authors || []).filter(isResolved<User>).map((author) => ({
          name: author.name || "",
        })),
        content: (() => {
          try {
            const articleContent = article.content
              ? convertLexicalToHTML({
                  data: article.content,
                  converters: createHtmlConverters(`${siteUrl()}/articles/${article.slug}`),
                })
              : ""
            const footnotesHtml = formatFootnotes(article.footnotes)
            return articleContent + footnotesHtml
          } catch (error) {
            console.error("Error converting article content to HTML:", error)
            return ""
          }
        })(),
        extensions: [
          {
            name: "updated",
            objects: { updated: new Date(article.updatedAt).toISOString() },
          },
        ],
      })
    }
  })

  return feed.atom1()
}

export const generateVolumeFeed = (volumes: Volume[]): string => {
  const feed = new Feed(createBaseFeedConfig("Volumes"))

  volumes.forEach((volume) => {
    if (volume._status === "published" && volume.publishedAt) {
      feed.addItem({
        title: volume.title,
        id: `${siteUrl()}/volumes/${volume.slug}`,
        link: `${siteUrl()}/volumes/${volume.slug}`,
        description: volume.meta?.description || "",
        date: new Date(volume.publishedAt),
        image:
          volume.meta?.image && typeof volume.meta.image !== "string"
            ? getMediaUrl((volume.meta.image as Media).url ?? "")
            : undefined,
        content: formatVolumeContent(volume),
        extensions: [
          {
            name: "updated",
            objects: { updated: new Date(volume.updatedAt).toISOString() },
          },
        ],
        published: new Date(volume.publishedAt),
        author: volume.articles?.filter(isResolved<Article>).flatMap(
          (article) =>
            (article.authors || []).filter(isResolved<User>).map((author) => ({
              name: author.name || "",
            })) || [],
        ),
      })
    }
  })

  return feed.atom1()
}
