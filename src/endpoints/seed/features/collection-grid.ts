import type { Page } from "@/payload-types"
import type { Payload } from "payload"
import { createOrUpdatePage } from "../pages"

/**
 * Creates the home page with CollectionGrid blocks and saves it to the `pages` collection.
 *
 * The page mirrors the exported homepage.json layout:
 *   1. Content block  – "Vespucci Style Article Grid"
 *   2. CollectionGrid    – vespucci-7 layout
 *   3. Content block  – "Fibonacci Style Article Grid"
 *   4. CollectionGrid    – fibonacci-7 layout
 *   9. Content block  – "Newton 4 Style Article Grid"
 *  10. CollectionGrid    – newton-4 layout
 *   5. Content block  – "Euler 3 Style Article Grid"
 *   6. CollectionGrid    – euler-3 layout
 *   7. Content block  – "Euler 5 Style Article Grid"
 *   8. CollectionGrid    – euler-5 layout
 *  11. Content block  – "Fibonacci 6 Style Article Grid"
 *  12. CollectionGrid    – fibonacci-6 layout
 *  13. Content block  – "Euler 2 Style Article Grid"
 *  14. CollectionGrid    – euler-2 layout
 *  15. Content block  – "Bernoulli Left Style Article Grid"
 *  16. CollectionGrid    – bernoulli-left layout
 *  17. Content block  – "Bernoulli Right Style Article Grid"
 *  18. CollectionGrid    – bernoulli-right layout
 *
 * @param volume1ArticleIds - Volume 1 article IDs (6 articles)
 * @param volume2ArticleIds - Volume 2 article IDs (at least 2 needed)
 * @param featureArticleIds - Feature article IDs (index 0 = rich text defaults)
 */
export async function createCollectionGridHomePage(
  payload: Payload,
  volume1ArticleIds: number[],
  volume2ArticleIds: number[],
  featureArticleIds: number[],
): Promise<Page> {
  return await createOrUpdatePage(payload, {
    title: "Home",
    slug: "home",
    generateSlug: false,
    _status: "published",
    publishedAt: new Date().toISOString(),
    hero: {
      type: "none",
    },
    layout: [
      {
        blockType: "collectionGrid",
        blockName: "Vespucci 7",
        layout: "vespucci-7",
        slots: [
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[0]!,
            },
            kicker: "Ethics",
            overrideTitle: "The Trolley Problem Today",
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[1]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[2]!,
            },
            kicker: "Society",
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[3]!,
            },
            kicker: null,
            overrideTitle: "Who Are You After a Decade?",
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[4]!,
            },
            kicker: "From the archive",
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[5]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume2ArticleIds[1]!,
            },
            kicker: "Memes",
            overrideTitle: "Irony as Ideology",
          },
        ],
      },
      {
        blockType: "collectionGrid",
        blockName: "Fibonacci 7",
        layout: "fibonacci-7",
        slots: [
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[0]!,
            },
            kicker: "Philosophy",
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[0]!,
            },
            kicker: null,
            overrideTitle: "Moral Intuition in the Age of Autonomous Vehicles",
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[1]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[2]!,
            },
            kicker: "Digital age",
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[3]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[4]!,
            },
            kicker: "Workplace ethics",
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[5]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume2ArticleIds[0]!,
            },
            kicker: null,
            overrideTitle: null,
          },
        ],
      },
      {
        blockType: "collectionGrid",
        blockName: "Euler 3",
        layout: "euler-3",
        slots: [
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[0]!,
            },
            kicker: "Featured",
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[4]!,
            },
            kicker: "Beauvoir",
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume2ArticleIds[1]!,
            },
            kicker: null,
            overrideTitle: "How the Internet Weaponised Humour",
          },
        ],
      },
      {
        blockType: "collectionGrid",
        blockName: "Newton 4",
        layout: "newton-4",
        slots: [
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[2]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume2ArticleIds[0]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume2ArticleIds[1]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[0]!,
            },
            kicker: null,
            overrideTitle: null,
          },
        ],
      },

      {
        blockType: "collectionGrid",
        blockName: "Euler 5",
        layout: "euler-5",
        slots: [
          {
            collection: {
              relationTo: "articles",
              value: featureArticleIds[0]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[1]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: featureArticleIds[0]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[5]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[3]!,
            },
            kicker: null,
            overrideTitle: null,
          },
        ],
      },
      {
        blockType: "collectionGrid",
        blockName: "Fibonacci 6",
        layout: "fibonacci-6",
        slots: [
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[1]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[0]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[2]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[5]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume2ArticleIds[0]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[3]!,
            },
            kicker: null,
            overrideTitle: null,
          },
        ],
      },
      {
        blockType: "collectionGrid",
        blockName: "Euler 2",
        layout: "euler-2",
        slots: [
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[3]!,
            },
            kicker: null,
            overrideTitle: null,
          },
          {
            collection: {
              relationTo: "articles",
              value: volume2ArticleIds[1]!,
            },
            kicker: null,
            overrideTitle: null,
          },
        ],
      },
      {
        blockType: "collectionGrid",
        blockName: "Bernoulli Left",
        layout: "bernoulli-left",
        slots: [
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[0]!,
            },
            kicker: null,
            overrideTitle: null,
          },
        ],
      },
      {
        blockType: "collectionGrid",
        blockName: "Bernoulli Right",
        layout: "bernoulli-right",
        slots: [
          {
            collection: {
              relationTo: "articles",
              value: volume1ArticleIds[1]!,
            },
            kicker: null,
            overrideTitle: null,
          },
        ],
      },
      {
        blockType: "cta",
        blockName: "Subscribe CTA",
        richText: {
          root: {
            children: [
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: "normal",
                    style: "",
                    text: "Stay up to date with Pragmatic Papers",
                    type: "text",
                    version: 1,
                  },
                ],
                direction: "ltr" as const,
                format: "" as const,
                indent: 0,
                tag: "h3",
                type: "heading",
                version: 1,
              },
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: "normal",
                    style: "",
                    text: "Get the latest articles, volumes, and updates delivered straight to you.",
                    type: "text",
                    version: 1,
                  },
                ],
                direction: "ltr" as const,
                format: "" as const,
                indent: 0,
                type: "paragraph",
                version: 1,
                textFormat: 0,
                textStyle: "",
              },
            ],
            direction: "ltr" as const,
            format: "" as const,
            indent: 0,
            type: "root",
            version: 1,
          },
        },
        links: [
          {
            link: {
              type: "custom",
              url: "https://discord.gg/digitalgroundgame",
              label: "Join Us",
              appearance: "default",
              newTab: true,
            },
          },
        ],
      },
    ],
    meta: {
      title: "Home",
      image: null,
      description: "Home page",
    },
  })
}
