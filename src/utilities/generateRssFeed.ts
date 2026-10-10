import { bannerToHTML } from "@/blocks/Banner/converters"
import { codeToHTML } from "@/blocks/Code/converters"
import { footnotesToHTML, footnoteToHTML } from "@/blocks/Footnote/converters"
import { interactiveMapToHTML } from "@/blocks/InteractiveMap/converters"
import { displayMathToHTML, inlineMathToHTML } from "@/blocks/Math/converters"
import { mediaBlockToHTML } from "@/blocks/MediaBlock/converters"
import { mediaCollageToHTML } from "@/blocks/MediaCollageBlock/converters"
import { socialEmbedToHTML } from "@/blocks/SocialEmbed/converters"
import { squiggleRuleToHTML } from "@/blocks/SquiggleRule/converters"
import { timelineToHTML } from "@/blocks/Timeline/converters"
import { internalDocToHref } from "@/components/RichText/internalDocToHref"
import type { Article, Media, User, Volume } from "@/payload-types"
import { isResolved } from "@/utilities/relationships"
import type { SerializedLinkNode } from "@payloadcms/richtext-lexical"
import {
  convertLexicalToHTML,
  LinkHTMLConverter,
  type HTMLConvertersFunction,
} from "@payloadcms/richtext-lexical/html"
import { Feed } from "feed"
import { absoluteURL, escapeHTML, fromBlock } from "./feedHTML"
import { getServerSideURL } from "./getURL"

// Read on each call, not at import: SERVER_URL is a runtime variable.
const siteUrl = (): string => getServerSideURL()

const getMediaUrl = (url: string) => {
  const absolute = absoluteURL(url, siteUrl())
  try {
    return new URL(absolute).href
  } catch {
    return absolute
  }
}

/**
 * Converters for the RSS feeds' rich text. Each block renders through the
 * converter in its own `src/blocks/<Name>/converters.ts`; this is the map from
 * block slug to the output format the RSS feeds want. Every node type and
 * block a feed-rendered field allows needs an entry here, or the feed prints
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
    const context = { siteUrl: siteUrl(), pageUrl }
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
      blocks: {
        ...defaultConverters.blocks,
        banner: fromBlock(bannerToHTML, context),
        code: fromBlock(codeToHTML, context),
        displayMathBlock: fromBlock(displayMathToHTML, context),
        interactiveMap: fromBlock(interactiveMapToHTML, context),
        mediaBlock: fromBlock(mediaBlockToHTML, context),
        mediaCollage: fromBlock(mediaCollageToHTML, context),
        socialEmbed: fromBlock(socialEmbedToHTML, context),
        blueSkyEmbed: fromBlock(socialEmbedToHTML, context),
        redditEmbed: fromBlock(socialEmbedToHTML, context),
        tiktokEmbed: fromBlock(socialEmbedToHTML, context),
        twitterEmbed: fromBlock(socialEmbedToHTML, context),
        youtubeEmbed: fromBlock(socialEmbedToHTML, context),
        squiggleRule: fromBlock(squiggleRuleToHTML, context),
        timeline: fromBlock(timelineToHTML, context),
      },
      inlineBlocks: {
        ...defaultConverters.inlineBlocks,
        footnote: fromBlock(footnoteToHTML, context),
        inlineMathBlock: fromBlock(inlineMathToHTML, context),
      },
    }
  }

const articleLinkHTML = (article: Article): string => {
  const href = escapeHTML(`${siteUrl()}/articles/${article.slug}`)
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
        converters: createHtmlConverters(`${siteUrl()}/volumes/${volume.slug}`),
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
          converters: createHtmlConverters(`${siteUrl()}/articles/${article.slug}`),
        })
      : ""
    return content + footnotesToHTML(article.footnotes, { siteUrl: siteUrl() })
  } catch (error) {
    console.error("Error converting article content to HTML:", error)
    return ""
  }
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
        id: `${siteUrl()}/articles/${article.slug}`,
        link: `${siteUrl()}/articles/${article.slug}`,
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
        id: `${siteUrl()}/volumes/${volume.slug}`,
        link: `${siteUrl()}/volumes/${volume.slug}`,
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
