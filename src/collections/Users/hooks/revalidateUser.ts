import type { User } from "@/payload-types"
import { revalidatePath } from "next/cache"
import type { CollectionAfterChangeHook } from "payload"

export const revalidateUser: CollectionAfterChangeHook<User> = async ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc

  const slugsToRevalidate = new Set<string | null | undefined>()
  slugsToRevalidate.add(doc.slug)
  if (previousDoc?.slug && previousDoc.slug !== doc.slug) {
    slugsToRevalidate.add(previousDoc.slug)
  }

  for (const slug of slugsToRevalidate) {
    if (slug) {
      const path = `/authors/${slug}`
      payload.logger.info(`Revalidating author at path: ${path}`)
      revalidatePath(path)
    }
  }

  payload.logger.info(`Revalidating authors index at path: /authors`)
  revalidatePath("/authors")

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

  for (const article of articles.docs) {
    const path = `/articles/${article.slug}`
    payload.logger.info(`Revalidating article at path: ${path}`)
    revalidatePath(path)
  }

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

    for (const volume of volumes.docs) {
      const volumePath = `/volumes/${volume.slug}`
      payload.logger.info(`Revalidating volume at path: ${volumePath}`)
      revalidatePath(volumePath)
    }
  }

  return doc
}
