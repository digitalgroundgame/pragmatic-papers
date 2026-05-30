import { type RelationshipFieldManyValidation, getPayload } from "payload"
import configPromise from "@payload-config"

export const checkArticles: RelationshipFieldManyValidation = async (value) => {
  const fieldValue = value as number[]

  if (!fieldValue?.length) return true

  const payload = await getPayload({ config: configPromise })

  const articles = await payload.find({
    collection: "articles",
    where: { id: { in: fieldValue } },
    draft: true,
    overrideAccess: true,
    depth: 0,
  })

  const unpublished = articles.docs.filter((article) => article._status !== "published")

  if (unpublished.length === 0) return true

  return `The following articles are not published: ${unpublished.map((article) => article.title).join(", ")}`
}
