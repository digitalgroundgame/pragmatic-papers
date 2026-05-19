"use client"

import RichText from "@/components/RichText"
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import React from "react"
import type { ArticlePageItem, FeedArticle, LexicalNode } from "./types"

function makeRoot(nodes: LexicalNode[]): DefaultTypedEditorState {
  return {
    root: {
      type: "root",
      version: 1,
      children: nodes,
      direction: "ltr",
      format: "",
      indent: 0,
    },
  } as unknown as DefaultTypedEditorState
}

function makeBlockRoot(node: LexicalNode): DefaultTypedEditorState {
  return makeRoot([node])
}

interface ArticleContentPageProps {
  article: FeedArticle
  page: ArticlePageItem
  topInset: number
}

export function ArticleContentPage({
  article,
  page,
  topInset,
}: ArticleContentPageProps): React.ReactNode {
  if (page.kind !== "content") return null

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black text-white">
      <div
        className="absolute inset-0 overflow-y-auto overscroll-contain"
        style={{ paddingTop: topInset + 24, paddingBottom: 32 }}
      >
        <div className="mx-auto max-w-2xl px-5">
          <div className="feed-prose text-white">
            <RichText
              data={makeRoot(page.nodes)}
              enableGutter={false}
              parentDoc={{ collection: "articles", id: article.id }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface ArticleBlockPageProps {
  article: FeedArticle
  page: ArticlePageItem
  topInset: number
}

export function ArticleBlockPage({
  article,
  page,
  topInset,
}: ArticleBlockPageProps): React.ReactNode {
  if (page.kind !== "block") return null

  return (
    <div className="relative flex h-dvh w-full items-center justify-center overflow-hidden bg-black text-white">
      <div
        className="w-full max-w-3xl overflow-y-auto px-4"
        style={{ paddingTop: topInset + 24, paddingBottom: 32, maxHeight: "100dvh" }}
      >
        <div className="feed-prose text-white">
          <RichText
            data={makeBlockRoot(page.node)}
            enableGutter={false}
            parentDoc={{ collection: "articles", id: article.id }}
          />
        </div>
      </div>
    </div>
  )
}
