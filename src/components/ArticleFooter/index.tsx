import React from "react"

import type { FootnotesField, Topic, User } from "@/payload-types"

import { AuthorList } from "@/components/Authors/AuthorList"
import { FootnoteList } from "@/components/FootnoteList"
import { TopicsList } from "@/components/Topics/TopicsList"
import { Separator } from "@/components/ui/separator"

export interface ArticleFooterProps {
  footnotes?: FootnotesField
  topics?: (number | Topic)[] | null
  authors?: User[] | null
  /** Rendered last, after the authors: the article's comments. */
  children?: React.ReactNode
}

/** What follows an article's body: its sources, topics, authors and comments, evenly spaced. */
export const ArticleFooter: React.FC<ArticleFooterProps> = ({
  footnotes,
  topics,
  authors,
  children,
}) => (
  <div className="space-y-10">
    <FootnoteList footnotes={footnotes} />
    <div className="space-y-4">
      <Separator />
      <TopicsList topics={topics} label="Topics:" />
    </div>
    <AuthorList aria-label="Article Authors" authors={authors} />
    {children}
  </div>
)
