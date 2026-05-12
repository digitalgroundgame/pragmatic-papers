import { AuthorList } from "@/components/Authors/AuthorList"
import type { PopulatedAuthors, PopulatedAuthorsSelect } from "@/payload-types"
import { getServerSideURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import configPromise from "@payload-config"
import type { Metadata } from "next"
import { draftMode } from "next/headers"
import { getPayload } from "payload"
import React from "react"

export const metadata: Metadata = {
  title: "Authors — Pragmatic Papers",
  description: "Discover all Pragmatic Papers authors and explore their published work.",
  openGraph: mergeOpenGraph({
    title: "Authors — Pragmatic Papers",
    description: "Discover all Pragmatic Papers authors and explore their published work.",
    url: `${getServerSideURL()}/authors`,
  }),
}

async function queryAuthors(): Promise<NonNullable<PopulatedAuthors>> {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config: configPromise })

  const select: PopulatedAuthorsSelect<true> = {
    id: true,
    name: true,
    slug: true,
    affiliation: true,
    biography: true,
    profileImage: true,
    socials: true,
  }

  const { docs } = await payload.find({
    collection: "users",
    draft,
    limit: 1000,
    pagination: false,
    sort: "name",
    depth: 1,
    where: {
      role: {
        in: ["writer", "editor", "chief-editor"],
      },
    },
    select,
  })

  return docs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    affiliation: doc.affiliation,
    biography: doc.biography,
    profileImage: doc.profileImage,
    socials: doc.socials,
  }))
}

export default async function AuthorsIndexPage(): Promise<React.ReactNode> {
  const authors = await queryAuthors()

  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4">
      <h1>Authors</h1>
      <p>Learn more about The Pragmatic Papers contributors and explore their work.</p>
      {authors.length === 0 ? (
        <p className="text-muted-foreground text-sm">No authors available yet.</p>
      ) : (
        <AuthorList authors={authors} />
      )}
    </article>
  )
}
