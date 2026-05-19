"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Media } from "@/components/Media"
import type { PopulatedAuthors } from "@/payload-types"
import { getClientSideURL } from "@/utilities/getURL"
import { cn } from "@/utilities/utils"
import { Share2 } from "lucide-react"
import Link from "next/link"
import React, { useCallback } from "react"
import type { FeedArticle } from "./types"

interface FeedActionColumnProps {
  article: FeedArticle
}

type ResolvedAuthor = NonNullable<PopulatedAuthors>[number]

const MAX_VISIBLE_AVATARS = 3

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

// The right-aligned column of per-article actions that sits above the
// hero title card. Author avatars on top, action buttons below; this is
// where future narration / comments controls will live too.
export function FeedActionColumn({ article }: FeedActionColumnProps): React.ReactNode {
  const handleShare = useCallback(() => {
    const url = `${getClientSideURL()}/articles/${article.slug}`
    const title = article.title
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      navigator.share({ title, url }).catch(() => {
        /* user cancelled or share unavailable */
      })
      return
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(url).catch(() => {
        /* clipboard blocked */
      })
    }
  }, [article.slug, article.title])

  const authors: ResolvedAuthor[] = (article.populatedAuthors ?? []).filter(
    (a): a is ResolvedAuthor => typeof a === "object" && Boolean(a?.slug),
  )
  const visibleAuthors = authors.slice(0, MAX_VISIBLE_AVATARS)
  const overflow = authors.length - visibleAuthors.length

  return (
    <div className="flex flex-col items-end gap-3">
      {visibleAuthors.length > 0 && (
        <div className="flex flex-col items-end">
          {visibleAuthors.map((author, idx) => {
            const profileImage = author.profileImage
            const profileImageUrl = getProfileImageUrl(author)
            const name = author.name || "Author"
            return (
              <Link
                key={author.id}
                href={`/authors/${author.slug}`}
                aria-label={name}
                className={cn(
                  "block",
                  // Stack vertically with a small overlap so multiple authors
                  // read as a cluster, not a list. First avatar has no overlap.
                  idx > 0 && "-mt-3",
                )}
                style={{ zIndex: MAX_VISIBLE_AVATARS - idx }}
              >
                <Avatar
                  size="default"
                  className="aspect-square rounded-full ring-2 ring-white/70 hover:opacity-90"
                >
                  <AvatarImage
                    src={profileImageUrl}
                    render={
                      profileImage && typeof profileImage !== "number" ? (
                        <Media media={profileImage} sizes="32px" variant="square" />
                      ) : undefined
                    }
                  />
                  <AvatarFallback className="bg-foreground/15 rounded-full text-xs text-white">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
              </Link>
            )
          })}
          {overflow > 0 && (
            <div
              className="bg-foreground/15 -mt-3 flex size-8 items-center justify-center rounded-full text-xs text-white ring-2 ring-white/70"
              aria-label={`${overflow} more authors`}
            >
              {`+${overflow}`}
            </div>
          )}
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleShare}
        className="h-10 w-10 rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 hover:text-white"
        aria-label="Share article"
      >
        <Share2 className="size-5" />
      </Button>
    </div>
  )
}
