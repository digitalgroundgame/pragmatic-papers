import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html"

import type { FeedContext, RichTextData } from "@/utilities/feedHTML"

export const PAGE_PATH = "/articles/example-article"

/**
 * The context a block's feed converter gets, for its `Feed` story and its
 * snapshot test. Nested rich text goes through Payload's default HTML
 * converters. Stories pass the page's own origin, so media they reference
 * stays on Storybook's static dir; tests pass a fixed one for stable output.
 */
export function feedContext(siteUrl = "https://example.org"): FeedContext {
  return {
    siteUrl,
    pageUrl: `${siteUrl}${PAGE_PATH}`,
    richTextToHTML: (data: RichTextData) =>
      convertLexicalToHTML({ data: data as never, disableContainer: true }),
  }
}

/** The context for a `Feed` story: absolute URLs on Storybook's own origin. */
export const storyFeedContext = (): FeedContext => feedContext(window.location.origin)
