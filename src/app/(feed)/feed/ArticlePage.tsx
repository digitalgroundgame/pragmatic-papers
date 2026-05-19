"use client"

import RichText from "@/components/RichText"
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import React from "react"
import { getFeedBlockBehavior } from "./blocks/registry"
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

function headingText(node: LexicalNode): string {
  const children = Array.isArray(node.children) ? (node.children as LexicalNode[]) : []
  return children.map((c) => (typeof c.text === "string" ? c.text : headingText(c))).join("")
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
        className="absolute inset-0 flex flex-col justify-center"
        style={{
          paddingTop: topInset + 16,
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        <div className="mx-auto w-full max-w-2xl px-5">
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

  const heading = page.headingNode ? headingText(page.headingNode) : null
  const FeedComponent = getFeedBlockBehavior(page.blockType).FeedComponent

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-black text-white">
      {heading && (
        <div className="px-5" style={{ paddingTop: topInset + 16 }}>
          <div className="mx-auto w-full max-w-3xl">
            <h2 className="font-display text-2xl leading-tight text-white sm:text-3xl">
              {heading}
            </h2>
          </div>
        </div>
      )}
      <div
        className="flex flex-1 items-center justify-center overflow-hidden px-4"
        style={{
          paddingTop: heading ? 12 : topInset + 16,
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        <div className="feed-prose w-full max-w-3xl text-white">
          {FeedComponent ? (
            <FeedComponent node={page.node} article={article} />
          ) : (
            <RichText
              data={makeRoot([page.node])}
              enableGutter={false}
              parentDoc={{ collection: "articles", id: article.id }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
