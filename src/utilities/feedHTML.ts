import type { SerializedBlockNode, SerializedInlineBlockNode } from "@payloadcms/richtext-lexical"
import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"

/**
 * Helpers for the HTML the feeds (RSS, the Substack import feed) and the block
 * converters behind them (`src/blocks/<Name>/converters.ts`) build by hand.
 * Browser-safe: Storybook renders the converters' output, so nothing here may
 * import server-only code.
 */

/**
 * What a block converter needs to know about where its output goes. Passed
 * in, never read from the environment, so the same converter runs on the
 * server and in Storybook.
 */
export interface FeedContext {
  /** The site's origin, which site paths (media, internal links) are made absolute against. */
  siteUrl: string
  /** The page the block sits on, which blocks a feed can't show link back to. */
  pageUrl: string
  /** Render rich text nested in a block (a banner's content, a caption) with the feed's own converters. */
  richTextToHTML: (data: RichTextData) => string
}

/** A rich-text field's value: Payload's generated types and Lexical's `SerializedEditorState` both fit. */
export interface RichTextData {
  root: { children: SerializedLexicalNode[] }
}

type NodesToHTML = (args: { nodes: SerializedLexicalNode[] }) => string[]

/**
 * Adapt a block converter, `(fields, context) => html`, to the shape Payload's
 * Lexical HTML converters take, rendering nested rich text through the same
 * conversion the block sits in.
 */
export const fromBlock =
  <Fields>(
    toHTML: (fields: Fields, context: FeedContext) => string,
    context: Omit<FeedContext, "richTextToHTML">,
  ) =>
  ({
    node,
    nodesToHTML,
  }: {
    node: SerializedBlockNode | SerializedInlineBlockNode
    nodesToHTML: NodesToHTML
  }): string =>
    toHTML(node.fields as Fields, {
      ...context,
      richTextToHTML: (data) => nodesToHTML({ nodes: data.root.children }).join(""),
    })

/**
 * Escape a CMS value for HTML element content or a quoted attribute. Lexical
 * text is escaped by Payload's converters; every value a converter
 * interpolates itself has to go through this (#1024).
 */
export const escapeHTML = (value: string | null | undefined): string =>
  (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

/**
 * Make a site path absolute: feed readers and Substack resolve relative URLs
 * against their own origin, not ours. Absolute `http(s)` URLs pass through.
 */
export const absoluteURL = (url: string, siteUrl: string): string => {
  if (/^https?:\/\//.test(url)) return url
  return `${siteUrl}${url.startsWith("/") ? "" : "/"}${url}`
}
