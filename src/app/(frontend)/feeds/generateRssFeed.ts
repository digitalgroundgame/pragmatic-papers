import { footnotesToHTML } from "@/blocks/Footnote/converters"
import { feedBlockConverters } from "@/blocks/registry"
import { internalDocToHref } from "@/utilities/routes"
import type { Article, Media, User, Volume } from "@/payload-types"
import { isResolved } from "@/utilities/relationships"
import type { SerializedLinkNode } from "@payloadcms/richtext-lexical"
import {
  convertLexicalToHTML,
  LinkHTMLConverter,
  type HTMLConvertersFunction,
} from "@payloadcms/richtext-lexical/html"
import { Feed } from "feed"
import { escapeHTML } from "@/utilities/feedHTML"
import { absoluteURL, getSiteURL } from "@/utilities/getURL"

const getMediaUrl = (url: string) => {
  const absolute = absoluteURL(url)
  try {
    return new URL(absolute).href
  } catch {
    return absolute
  }
}

/**
 * Converters for the RSS feeds' rich text. Each block renders through the
 * `html` its descriptor in `src/blocks/registry.ts` declares. Every node type
 * and block a feed-rendered field allows needs a converter, or the feed prints
 * "unknown node" in its place; `__tests__/generateRssFeed.converters.test.ts`
 * enforces that against the resolved Payload config.
 *
 * `pageUrl` is the page the content lives on, which blocks a feed reader
 * cannot show (interactive maps) link back to, and which an internal link
 * whose document can't be resolved falls back to.
 */
export const createHtmlConverters =
  (pageUrl: string): HTMLConvertersFunction =>
  ({ defaultConverters }) => {
    const context = { siteUrl: getSiteURL(), pageUrl }
    const { blocks, inlineBlocks } = feedBlockConverters("html", context)
    return {
      ...defaultConverters,
      // Payload's default link converter has no `internalDocToHref`, so every
      // internal link would render as `href="#"`. Feed readers need
      // absolute URLs; the site's helper returns a path.
      ...LinkHTMLConverter({
        internalDocToHref: ({ linkNode }: { linkNode: SerializedLinkNode }) => {
          try {
            return absoluteURL(internalDocToHref({ linkNode }), context.siteUrl)
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
      blocks: { ...defaultConverters.blocks, ...blocks },
      inlineBlocks: { ...defaultConverters.inlineBlocks, ...inlineBlocks },
    }
  }

const articleLinkHTML = (article: Article): string => {
  const href = escapeHTML(`${getSiteURL()}/articles/${article.slug}`)
  const description = article.meta?.description
    ? `<p>${escapeHTML(article.meta.description)}</p>`
    : ""
  return `<li><a href="${href}">${escapeHTML(article.title)}</a>${description}</li>`
}

const volumeContentHTML = (volume: Volume): string => {
  const description = volume.description ? `<p>${escapeHTML(volume.description)}</p>` : ""
  const editorsNote = volume.editorsNote
    ? convertLexicalToHTML({
        data: volume.editorsNote,
        converters: createHtmlConverters(`${getSiteURL()}/volumes/${volume.slug}`),
      })
    : ""
  // An article not loaded at this depth is a bare numeric ID: leave it out
  // rather than link to `/articles/undefined`.
  const articles = volume.articles
    ?.filter(isResolved<Article>)
    .map(articleLinkHTML)
    .join("")
  const articleList = articles ? `<h3>Articles in this Volume</h3><ul>${articles}</ul>` : ""

  return description + editorsNote + articleList
}

const articleContentHTML = (article: Article): string => {
  try {
    const content = article.content
      ? convertLexicalToHTML({
          data: article.content,
          converters: createHtmlConverters(`${getSiteURL()}/articles/${article.slug}`),
        })
      : ""
    return content + footnotesToHTML(article.footnotes, { siteUrl: getSiteURL() })
  } catch (error) {
    console.error("Error converting article content to HTML:", error)
    return ""
  }
}

const createBaseFeedConfig = (type: "Articles" | "Volumes") => ({
  title: `The Pragmatic Papers - ${type}`,
  description: `Latest ${type.toLowerCase()} from The Pragmatic Papers`,
  id: getSiteURL(),
  link: getSiteURL(),
  language: "en",
  favicon: `${getSiteURL()}/favicon.ico`,
  copyright: `All rights reserved ${new Date().getFullYear()}`,
  generator: "The Pragmatic Papers",
  updated: new Date(),
  feedLinks: {
    atom: `${getSiteURL()}/${type.toLowerCase()}/feed.xml`,
  },
})

const imageUrl = (image: number | Media | null | undefined): string | undefined =>
  isResolved<Media>(image) && image.url ? getMediaUrl(image.url) : undefined

const authorsOf = (article: Article) =>
  (article.authors || []).filter(isResolved<User>).map((author) => ({ name: author.name || "" }))

export const generateArticleFeed = (articles: Article[]): string => {
  const feed = new Feed(createBaseFeedConfig("Articles"))

  articles.forEach((article) => {
    if (article._status === "published" && article.publishedAt) {
      feed.addItem({
        title: article.title,
        id: `${getSiteURL()}/articles/${article.slug}`,
        link: `${getSiteURL()}/articles/${article.slug}`,
        published: new Date(article.publishedAt),
        description: article.meta?.description ? article.meta.description : "",
        date: new Date(article.publishedAt),
        image: imageUrl(article.meta?.image),
        author: authorsOf(article),
        content: articleContentHTML(article),
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
        id: `${getSiteURL()}/volumes/${volume.slug}`,
        link: `${getSiteURL()}/volumes/${volume.slug}`,
        description: volume.meta?.description || "",
        date: new Date(volume.publishedAt),
        image: imageUrl(volume.meta?.image),
        content: volumeContentHTML(volume),
        extensions: [
          {
            name: "updated",
            objects: { updated: new Date(volume.updatedAt).toISOString() },
          },
        ],
        published: new Date(volume.publishedAt),
        author: volume.articles?.filter(isResolved<Article>).flatMap(authorsOf),
      })
    }
  })

  return feed.atom1()
}
