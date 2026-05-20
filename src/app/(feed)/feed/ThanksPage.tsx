"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Media } from "@/components/Media"
import type { PopulatedAuthors } from "@/payload-types"
import { ArrowRight, Home } from "lucide-react"
import Link from "next/link"
import React from "react"
import type { FeedArticle } from "./types"

interface ThanksPageProps {
  article: FeedArticle
  topInset: number
}

type ResolvedAuthor = NonNullable<PopulatedAuthors>[number]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() || ""
  return ((parts[0]?.charAt(0) || "") + (parts[1]?.charAt(0) || "")).toUpperCase()
}

function getProfileImageUrl(author: ResolvedAuthor): string | undefined {
  const img = author.profileImage
  if (!img || typeof img === "number") return undefined
  return img.sizes?.square?.url ?? img.url ?? undefined
}

export function ThanksPage({ article, topInset }: ThanksPageProps): React.ReactNode {
  const primaryAuthor = (article.populatedAuthors ?? []).find(
    (a): a is ResolvedAuthor => typeof a === "object" && Boolean(a?.name),
  )
  const next = article.nextArticle ?? null

  return (
    <div className="bg-background text-foreground relative h-full w-full overflow-hidden">
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 text-center"
        style={{
          paddingTop: topInset + 16,
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        {primaryAuthor && (
          <Avatar size="xl" className="aspect-square rounded-full ring-2 ring-white/30">
            <AvatarImage
              src={getProfileImageUrl(primaryAuthor)}
              render={
                primaryAuthor.profileImage && typeof primaryAuthor.profileImage !== "number" ? (
                  <Media media={primaryAuthor.profileImage} sizes="96px" variant="square" />
                ) : undefined
              }
            />
            <AvatarFallback className="bg-foreground/15 rounded-full text-base">
              {getInitials(primaryAuthor.name || "")}
            </AvatarFallback>
          </Avatar>
        )}

        <div className="space-y-1">
          <h2 className="font-display text-3xl leading-tight">Thanks for reading</h2>
          {primaryAuthor?.name && (
            <p className="text-muted-foreground font-serif text-sm">— {primaryAuthor.name}</p>
          )}
        </div>

        {next ? (
          <Link
            href={`/feed/articles/${next.slug}`}
            className="border-border bg-muted/30 hover:bg-muted/50 group mt-2 flex w-full max-w-sm items-center gap-3 rounded-2xl border p-3 text-left transition-colors"
          >
            {next.heroImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={next.heroImageUrl}
                alt=""
                className="size-14 shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground font-sans text-[11px] tracking-wide uppercase">
                More like this
              </p>
              <p className="font-display line-clamp-2 text-sm leading-snug">{next.title}</p>
              {next.authorName && (
                <p className="text-muted-foreground mt-0.5 font-serif text-xs">
                  by {next.authorName}
                </p>
              )}
            </div>
            <ArrowRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <Link
            href="/"
            className="border-border bg-muted/30 hover:bg-muted/50 inline-flex items-center gap-2 rounded-full border px-4 py-2 font-sans text-sm transition-colors"
          >
            <Home className="size-4" />
            Back to home
          </Link>
        )}
      </div>
    </div>
  )
}
