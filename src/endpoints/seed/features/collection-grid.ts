import type { Page } from "@/payload-types"
import type { Payload } from "payload"
import { devMerchCatalogue, seedMerchProducts } from "../merch"
import { createOrUpdatePage } from "../pages"

/**
 * Creates the home page with CollectionGrid blocks and saves it to the `pages` collection.
 *
 * A full-width Merch block ("Store Merch") sits fourth, after the first
 * three grids, as an on-site store ad placement.
 *
 * Block order (CollectionGrid layouts unless noted):
 *   1. gauss-10
 *   2. vespucci-7
 *   3. fibonacci-7
 *   4. Merch – full-width "Store Merch"
 *   5. euler-3
 *   6. newton-4
 *   7. euler-5
 *   8. fibonacci-6
 *   9. euler-2
 *  10. bernoulli-left
 *  11. bernoulli-right
 *
 * @param volume1ArticleIds - Volume 1 article IDs (6 articles)
 * @param volume2ArticleIds - Volume 2 article IDs (at least 2 needed)
 * @param featureArticleIds - Feature article IDs (index 0 = rich text defaults)
 * @param mediaIds - Media IDs used for the Merch product images
 */
export async function createCollectionGridHomePage(
  payload: Payload,
  volume1ArticleIds: number[],
  volume2ArticleIds: number[],
  featureArticleIds: number[],
  mediaIds: number[],
): Promise<Page> {
  // The Merch block below stores a query, not products — seed the catalogue it
  // resolves against.
  await seedMerchProducts(payload, devMerchCatalogue(mediaIds))

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
        blockName: "Gauss 10",
        layout: "gauss-10",
        slots: [
          // 0: Featured Center
          {
            collection: { relationTo: "articles", value: volume1ArticleIds[0]! },
            kicker: "Featured",
            overrideTitle: null,
          },
          // 1: A — Left Column, Top
          {
            collection: { relationTo: "articles", value: volume1ArticleIds[1]! },
            kicker: null,
            overrideTitle: null,
          },
          // 2: B — Left Column, Middle (Compact)
          {
            collection: { relationTo: "articles", value: volume1ArticleIds[2]! },
            kicker: null,
            overrideTitle: null,
          },
          // 3: C — Left Column, Bottom (Compact)
          {
            collection: { relationTo: "articles", value: volume1ArticleIds[3]! },
            kicker: null,
            overrideTitle: null,
          },
          // 4: D — Right Column, Top
          {
            collection: { relationTo: "articles", value: volume1ArticleIds[4]! },
            kicker: null,
            overrideTitle: null,
          },
          // 5: E — Right Column, Middle (Compact)
          {
            collection: { relationTo: "articles", value: volume1ArticleIds[5]! },
            kicker: null,
            overrideTitle: null,
          },
          // 6: F — Right Column, Bottom (Compact)
          {
            collection: { relationTo: "articles", value: volume2ArticleIds[0]! },
            kicker: null,
            overrideTitle: null,
          },
          // 7: G — Bottom Left (always present)
          {
            collection: { relationTo: "articles", value: volume2ArticleIds[1]! },
            kicker: null,
            overrideTitle: null,
          },
          // 8: H — Bottom Center (optional)
          {
            collection: { relationTo: "articles", value: featureArticleIds[0]! },
            kicker: null,
            overrideTitle: null,
          },
          // 9: I — Bottom Right (optional)
          {
            collection: { relationTo: "articles", value: volume1ArticleIds[0]! },
            kicker: null,
            overrideTitle: null,
          },
        ],
      },
      {
        blockType: "merch",
        blockName: "Store Merch",
        heading: "DigitalGroundGame Store",
        layout: "fullWidth",
        autoplay: true,
        // The whole synced catalogue in sort order — no per-placement
        // curation, which is the point of syncing.
        source: "all",
        orderBy: "sortOrder",
        limit: 6,
      },
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
    ],
    meta: {
      title: "Home",
      image: null,
      description: "Home page",
    },
  })
}
