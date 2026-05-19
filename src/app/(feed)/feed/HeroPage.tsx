"use client"

import { Media } from "@/components/Media"
import { formatDateTime } from "@/utilities/formatDateTime"
import React from "react"
import type { FeedArticle } from "./types"

interface HeroPageProps {
  article: FeedArticle
  topInset: number
}

export function HeroPage({ article, topInset }: HeroPageProps): React.ReactNode {
  const authors = (article.populatedAuthors ?? [])
    .map((a) => (typeof a === "object" && a.name ? a.name : ""))
    .filter(Boolean)
  const volume = article.populatedVolume
  const topicNames = (article.topics ?? [])
    .map((t) => (typeof t === "object" && t.name ? t.name : ""))
    .filter(Boolean)
  const excerpt = article.meta?.description ?? null

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      {article.heroImage && typeof article.heroImage !== "number" ? (
        <div className="absolute inset-0">
          <Media
            priority
            fill
            sizes="100vw"
            media={article.heroImage}
            className="!rounded-none object-cover"
          />
        </div>
      ) : (
        <div className="from-brand/40 absolute inset-0 bg-gradient-to-br to-black" />
      )}

      <div
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10"
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 flex flex-col px-4"
        style={{
          paddingTop: topInset + 16,
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        <p className="text-center font-sans text-xs tracking-wide text-white/70 uppercase">
          Swipe to read →
        </p>

        <div className="flex-1" />

        <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
          {volume?.title && (
            <p className="font-sans text-xs tracking-wide text-white/70 uppercase">
              {volume.title}
            </p>
          )}
          <h1 className="font-display mt-1 text-3xl leading-tight text-white sm:text-4xl">
            {article.title}
          </h1>
          {excerpt && (
            <p className="mt-2 line-clamp-3 font-serif text-sm leading-snug text-white/85">
              {excerpt}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-serif text-sm text-white/80">
            {authors.length > 0 && <span>{`by ${authors.join(", ")}`}</span>}
            {authors.length > 0 && article.publishedAt && <span aria-hidden>•</span>}
            {article.publishedAt && (
              <time dateTime={article.publishedAt}>{formatDateTime(article.publishedAt)}</time>
            )}
          </div>
          {topicNames.length > 0 && (
            <p className="mt-2 font-sans text-xs tracking-wide text-white/60 uppercase">
              {topicNames.join(", ")}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
