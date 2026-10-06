import React from "react"

/**
 * A block's feed HTML (its `…ToHTML` converter's output), shown in a plain
 * prose column the way a feed reader would lay it out. Each block's `Feed`
 * story renders through this, so the feed markup gets the same axe check as
 * the web component.
 */
export const FeedHTML: React.FC<{ html: string }> = ({ html }) => (
  <article
    className="prose prose-brand max-w-prose font-serif"
    data-testid="feed-html"
    // The converters' own escaped output, from fixtures: showing that markup is the point.
    // eslint-disable-next-line react/no-danger
    dangerouslySetInnerHTML={{ __html: html }}
  />
)
