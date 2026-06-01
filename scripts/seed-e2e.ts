import { getPayload } from "payload"
import config from "@payload-config"

export async function seedE2E(): Promise<void> {
  const payload = await getPayload({ config })

  const article = await payload.create({
    collection: "articles",
    overrideAccess: true,
    draft: false,
    data: {
      title: "E2E Seed Article",
      slug: "e2e-seed-article",
      content: {
        root: {
          type: "root",
          children: [
            {
              type: "paragraph",
              children: [{ type: "text", text: "Seed content for E2E screenshots.", version: 1 }],
              direction: "ltr",
              format: "",
              indent: 0,
              version: 1,
            },
          ],
          direction: "ltr",
          format: "",
          indent: 0,
          version: 1,
        },
      },
      _status: "published",
    },
  })

  await payload.create({
    collection: "volumes",
    overrideAccess: true,
    draft: false,
    data: {
      title: "E2E Seed Volume",
      slug: "1",
      volumeNumber: 1,
      description: "Seed volume for E2E screenshots.",
      articles: [article.id],
      _status: "published",
    },
  })
}
