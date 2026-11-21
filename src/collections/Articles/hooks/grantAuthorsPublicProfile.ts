import { grantPublicProfile } from "@/collections/Users/hooks/grantPublicProfile"
import type { Article } from "@/payload-types"

/** Only a published byline links to a contributor page, so drafts and autosaves credit no one. */
export const publishedAuthors = (doc: Article): NonNullable<Article["authors"]> =>
  doc._status === "published" ? (doc.authors ?? []) : []

/** AfterChange hook that gives a published article's authors a public profile. */
export const grantAuthorsPublicProfile = grantPublicProfile<Article>(publishedAuthors)
