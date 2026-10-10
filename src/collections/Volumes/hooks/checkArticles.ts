import type { RelationshipFieldManyValidation } from "payload"

export const checkArticles: RelationshipFieldManyValidation = async (value, { req }) => {
  const fieldValue = value as number[]

  if (!fieldValue?.length) return true

  // The published documents, not each article's latest version: an article edited since it was
  // published has an autosave draft as its latest version, but it is still live.
  const articles = await req.payload.find({
    collection: "articles",
    where: { id: { in: fieldValue } },
    draft: false,
    overrideAccess: true,
    depth: 0,
    req,
  })

  const unpublished = articles.docs.filter((article) => article._status !== "published")

  if (unpublished.length === 0) return true

  return `The following articles are not published: ${unpublished.map((article) => article.title).join(", ")}`
}
