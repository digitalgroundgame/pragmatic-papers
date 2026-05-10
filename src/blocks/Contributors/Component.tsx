import React from "react"

import type { ContributorsBlock as ContributorsBlockProps } from "@/payload-types"

import { AuthorCard } from "@/components/Authors/AuthorCard"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"

export const ContributorsBlock: React.FC<ContributorsBlockProps> = async ({ title, people }) => {
  const ids = people.map((p) => (typeof p === "number" ? p : p.id))
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

  if (!docs.length) return null

  return (
    <section aria-label={title} className="container my-4 max-w-3xl space-y-3">
      <h2>{title}</h2>
      <div className="flex flex-col gap-4">
        {docs.map((doc) => (
          <AuthorCard key={doc.id} author={doc} />
        ))}
      </div>
    </section>
  )
}
