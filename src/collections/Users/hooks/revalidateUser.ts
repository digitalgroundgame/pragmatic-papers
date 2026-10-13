import type { User } from "@/payload-types"
import type { CollectionAfterChangeHook } from "payload"

import { revalidateForReaders } from "@/hooks/revalidateForReaders"

export const revalidateUser: CollectionAfterChangeHook<User> = async ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc

  // Every path to revalidate here and purge on the Worker.
  const paths: string[] = []

  const slugsToRevalidate = new Set<string | null | undefined>()
  slugsToRevalidate.add(doc.slug)
  if (previousDoc?.slug && previousDoc.slug !== doc.slug) {
    slugsToRevalidate.add(previousDoc.slug)
  }

  for (const slug of slugsToRevalidate) {
    if (slug) paths.push(`/contributors/${slug}`)
  }
  paths.push("/contributors")

  // Find all published articles where this user is an author and revalidate them
  const articles = await payload.find({
    collection: "articles",
    where: {
      authors: {
        equals: doc.id,
      },
      _status: {
        equals: "published",
      },
    },
    select: {
      slug: true,
    },
    depth: 0,
    limit: 0,
    pagination: false,
  })

  for (const article of articles.docs) paths.push(`/articles/${article.slug}`)

  // Find volumes that contain these articles
  if (articles.docs.length > 0) {
    const articleIds = articles.docs.map((a) => a.id)

    const volumes = await payload.find({
      collection: "volumes",
      where: {
        "articles.id": {
          in: articleIds,
        },
      },
      select: {
        slug: true,
      },
      depth: 0,
      limit: 0,
      pagination: false,
    })

    for (const volume of volumes.docs) paths.push(`/volumes/${volume.slug}`)
  }

  // Bylines show on the listings too; `shared` covers them on the Worker.
  revalidateForReaders(payload.logger, `author ${doc.slug ?? doc.id}`, { paths, shared: true })

  return doc
}
