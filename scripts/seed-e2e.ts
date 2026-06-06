import { createRichTextShowcaseArticle } from "@/endpoints/seed/features/rich-text-showcase"
import { createUser } from "@/endpoints/seed/users"
import config from "@payload-config"
import { getPayload } from "payload"

const ctx = { disableRevalidate: true }

export async function main(): Promise<void> {
  const payload = await getPayload({ config })

  try {
    const writer = await createUser(
      payload,
      {
        email: "writer@e2e.test",
        password: "e2e-test-password-123",
        name: "E2E Writer",
        roles: ["writer"],
        slug: "e2e-writer",
      },
      "e2e writer",
      ctx,
    )

    // Typography showcase article (slug: "rich-text-showcase").
    // Pass [] for mediaDocs — all media accesses use ?. so heroImage/meta.image will be null.
    const articleId = await createRichTextShowcaseArticle(payload, [writer], [], [], ctx)

    const volume = await payload.create({
      collection: "volumes",
      context: ctx,
      data: {
        title: "E2E Test Volume",
        volumeNumber: 1,
        description: "A test volume for E2E testing.",
        articles: [articleId],
        slug: "1",
        _status: "published",
        publishedAt: new Date().toISOString(),
      },
    })

    // Homepage with a CollectionGrid so gotoFirstArticle / gotoFirstVolume can
    // find a[href*="/articles/"] and a[href*="/volumes/"] links to follow.
    await payload.create({
      collection: "pages",
      context: ctx,
      data: {
        title: "Home",
        slug: "home",
        _status: "published",
        publishedAt: new Date().toISOString(),
        hero: { type: "none" },
        layout: [
          {
            blockType: "collectionGrid",
            layout: "euler-2",
            slots: [
              {
                collection: { relationTo: "articles", value: articleId },
                kicker: null,
                overrideTitle: null,
              },
              {
                collection: { relationTo: "volumes", value: volume.id },
                kicker: null,
                overrideTitle: null,
              },
            ],
          },
        ],
      },
    })

    console.warn(`✔ E2E seed complete: article="rich-text-showcase", volume="1"`)
  } finally {
    await payload.db.destroy?.()
  }
}

if (!process.env.VITEST) {
  try {
    await main()
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
