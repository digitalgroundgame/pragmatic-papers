import React from "react"

import type { ContributorsBlock as ContributorsBlockProps, PopulatedAuthors } from "@/payload-types"

import { AuthorCard } from "@/components/Authors/AuthorCard"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"

export const ContributorsBlock: React.FC<ContributorsBlockProps> = async ({ title, people }) => {
  const ids = (people || []).map((p) => (typeof p === "number" ? p : p.id))
  if (!ids.length) return null

  const payload = await getPayloadConfig()
  const { docs } = await payload.find({
    collection: "users",
    limit: ids.length,
    pagination: false,
    depth: 1,
    where: { id: { in: ids } },
  })

  const orderById = new Map(ids.map((id, i) => [id, i]))
  docs.sort((a, b) => (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0))

  const contributors: NonNullable<PopulatedAuthors> = docs.map((doc) => ({
    id: String(doc.id),
    name: doc.name,
    slug: doc.slug,
    affiliation: doc.affiliation,
    biography: doc.biography,
    profileImage: doc.profileImage,
    socials: doc.socials,
  }))

  if (!contributors.length) return null

  return (
    <section aria-label={title} className="container my-4 max-w-3xl space-y-3">
      <h2>{title}</h2>
      <div className="flex flex-col gap-4">
        {contributors.map((contributor) => (
          <AuthorCard key={contributor.id} author={contributor} />
        ))}
      </div>
    </section>
  )
}
