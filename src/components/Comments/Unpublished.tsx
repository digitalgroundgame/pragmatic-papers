import React from "react"

/**
 * Where an article's comments go, while it's previewed before anyone can read it: comments
 * only open on published articles.
 */
export const CommentsUnpublished: React.FC = () => (
  <section id="comments" aria-labelledby="comments-heading" className="scroll-mt-24 space-y-6">
    <h2 id="comments-heading" className="font-display text-2xl">
      Comments
    </h2>
    <p className="text-muted-foreground text-sm">Comments open once this article is published.</p>
  </section>
)
