import type { PopulatedAuthors } from "@/payload-types"
import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext"
import React from "react"

import { AuthorLinks } from "@/components/Authors/AuthorLinks"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { Media } from "@/components/Media"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() || ""
  return (parts[0]?.charAt(0) || "") + (parts[1]?.charAt(0) || "").toUpperCase()
}

function extractBioSnippet(
  author: NonNullable<PopulatedAuthors>[number],
  maxLength = 255,
): string | undefined {
  if (!author.biography) return
  const text = convertLexicalToPlaintext({ data: author.biography })
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text
}

export interface AuthorCardProps {
  author: NonNullable<PopulatedAuthors>[number]
}

export const AuthorCard: React.FC<AuthorCardProps> = ({ author }) => {
  const { slug, name, affiliation } = author
  const initials = getInitials(name || "Author")
  const bioSnippet = extractBioSnippet(author)
  const profileImage = author.profileImage ?? undefined
  const profileImageUrl =
    typeof profileImage === "number" ? undefined : (profileImage?.sizes?.square?.url ?? undefined)

  return (
    <Card className="rounded-sm">
      <CardContent className="flex flex-col gap-4 sm:flex-row">
        <HoverPrefetchLink href={`/authors/${slug}`} aria-label={name || "Author profile"}>
          <Avatar size="xl" className="aspect-square border hover:opacity-80">
            <AvatarImage
              src={profileImageUrl}
              render={<Media media={profileImage} sizes="96px" variant="square" />}
            />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </HoverPrefetchLink>
        <div className="flex flex-col justify-between space-y-2">
          <div className="flex-1 space-y-1">
            <div className="flex flex-col md:flex-row md:items-end">
              <h3 className="text-pretty md:text-2xl">
                <HoverPrefetchLink
                  href={`/authors/${slug}`}
                  className="text-primary hover:text-primary/80"
                >
                  {name}
                </HoverPrefetchLink>
              </h3>
              {affiliation && (
                <span className="text-muted-foreground ml-1 line-clamp-1 text-sm font-normal">
                  {affiliation}
                </span>
              )}
            </div>
            {bioSnippet && (
              <p className="text-primary line-clamp-2 font-serif text-sm">{bioSnippet}</p>
            )}
          </div>
          <AuthorLinks socials={author.socials} />
        </div>
      </CardContent>
    </Card>
  )
}
