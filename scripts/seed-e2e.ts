import { FOUR_AUTHOR_SLUG, NARRATION_SECONDS, SEEDED_UPDATED_AT } from "./seed-e2e.constants"

import type { User } from "@/payload-types"
import { createArticle } from "@/endpoints/seed/articles"
import { createMoCongressionalMapsArticle } from "@/endpoints/seed/features/interactive-maps"
import { createFederalCourtsInteractive } from "@/endpoints/seed/features/interactives"
import { createRichTextShowcaseArticle } from "@/endpoints/seed/features/rich-text-showcase"
import {
  createCTABlockNode,
  createHeadingNode,
  createLinkNode,
  createNewsletterSignupBlockNode,
  createParagraph,
  createRichText,
  createTextNode,
} from "@/endpoints/seed/richtext"
import { seedMerchProducts } from "@/endpoints/seed/merch"
import { createUser } from "@/endpoints/seed/users"
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres"
import config from "@payload-config"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { getPayload } from "payload"
import type { Payload } from "payload"

const ctx = { disableRevalidate: true }

// Create a media doc from a file already committed to the repo. The rest of the
// e2e seed deliberately ships no media (hero images resolve to null), but the
// merch carousel screenshot needs something to render — so we upload one local
// PNG and point every seeded product at it. Reading from disk keeps the seed
// deterministic and network-free, unlike `createMediaFromURL`; synced products
// carry a cdn.shopify.com URL, which no offline test run could fetch.
async function createLocalMedia(
  payload: Payload,
  repoRelativePath: string,
  alt: string,
): Promise<number> {
  const data = await readFile(path.join(process.cwd(), repoRelativePath))
  const media = await payload.create({
    collection: "media",
    context: ctx,
    data: { alt },
    file: {
      name: `e2e-${path.basename(repoRelativePath)}`,
      data,
      mimetype: "image/png",
      size: data.byteLength,
    },
  })
  return media.id
}

// A silent WAV, synthesized rather than committed: the narration player only
// needs a file whose duration the browser agrees with, and generating the bytes
// keeps the repo free of a binary that exists solely to make a button say
// "Listen · 0:03". 8 kHz mono 16-bit PCM, so the header is the only interesting
// part and the samples are zeros.
function silentWav(seconds: number): Buffer {
  const sampleRate = 8000
  const bytesPerSample = 2
  const dataLength = sampleRate * bytesPerSample * seconds
  const buffer = Buffer.alloc(44 + dataLength)
  buffer.write("RIFF", 0)
  buffer.writeUInt32LE(36 + dataLength, 4)
  buffer.write("WAVE", 8)
  buffer.write("fmt ", 12)
  buffer.writeUInt32LE(16, 16) // PCM header length
  buffer.writeUInt16LE(1, 20) // PCM, uncompressed
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28) // byte rate
  buffer.writeUInt16LE(bytesPerSample, 32) // block align
  buffer.writeUInt16LE(8 * bytesPerSample, 34) // bits per sample
  buffer.write("data", 36)
  buffer.writeUInt32LE(dataLength, 40)
  return buffer
}

async function createSilentNarration(payload: Payload, seconds: number): Promise<number> {
  const data = silentWav(seconds)
  const media = await payload.create({
    collection: "media",
    context: ctx,
    data: { alt: "Silent narration used by the article hero e2e specs", duration: seconds },
    file: { name: "e2e-narration.wav", data, mimetype: "audio/wav", size: data.byteLength },
  })
  return media.id
}

// Screenshot baselines bake in this date via the article/volume byline, so it
// must stay fixed rather than tracking the day the seed happens to run.
const PUBLISHED_AT = "2026-06-04T00:00:00.000Z"

/**
 * Freeze the revision stamp on every seeded article and volume.
 *
 * Straight to the column, because there is no way through the API: Payload
 * overwrites `updatedAt` with the current time on every non-draft save
 * (collections/operations/utilities/update.js), so each hero's dateline would
 * read the day the seed ran and diff against its baseline the next day. The
 * instant is arbitrary; that it never moves is the point.
 *
 * Applied to whole tables after seeding rather than per document: the previous
 * per-document version pinned only the narrated article, and the share-button
 * baselines — framing a different article's hero — quietly rotted instead.
 */
async function pinRevisionStamps(payload: Payload): Promise<void> {
  const { drizzle } = payload.db as unknown as PostgresAdapter
  await drizzle.execute(sql`UPDATE articles SET updated_at = ${SEEDED_UPDATED_AT}`)
  await drizzle.execute(sql`UPDATE volumes SET updated_at = ${SEEDED_UPDATED_AT}`)
}

// Co-authors for the four-author article. Deliberately plain compared with the e2e
// writer — author-card.spec.ts covers the fully-populated profile, and these
// only ever appear as a name and a set of initials in a byline.
const CO_AUTHORS = [
  { name: "Sienna Scribe", slug: "e2e-co-author-sienna", email: "sienna@e2e.test" },
  { name: "Marcus Ledger", slug: "e2e-co-author-marcus", email: "marcus@e2e.test" },
  { name: "Alexandra Quill", slug: "e2e-co-author-alexandra", email: "alexandra@e2e.test" },
]

export async function main(): Promise<void> {
  const payload = await getPayload({ config })

  try {
    const writer = await createUser(
      payload,
      {
        email: "writer@e2e.test",
        password: "e2e-test-password-123",
        name: "Teagan Wordsmith",
        affiliation: "Senior Research Fellow, Pragmatic Papers Institute",
        biography: createRichText([
          createParagraph(
            "Teagan Wordsmith is a Senior Research Fellow at the Pragmatic Papers Institute, studying how empirical methods shape public policy and translating dense academic research into plain language for a general audience.",
          ),
        ]),
        roles: ["writer"],
        slug: "e2e-writer",
        // A full spread of platforms so the author card exercises every
        // branded icon variant (see AuthorLinks / detectPlatform). Capped at
        // the socials field's maxRows: 6.
        socials: [
          { link: { type: "custom", label: "X", url: "https://x.com/e2ewriter", newTab: true } },
          {
            link: {
              type: "custom",
              label: "YouTube",
              url: "https://youtube.com/@e2ewriter",
              newTab: true,
            },
          },
          {
            link: {
              type: "custom",
              label: "Twitch",
              url: "https://twitch.tv/e2ewriter",
              newTab: true,
            },
          },
          {
            link: {
              type: "custom",
              label: "Instagram",
              url: "https://instagram.com/e2ewriter",
              newTab: true,
            },
          },
          {
            link: {
              type: "custom",
              label: "Discord",
              url: "https://discord.gg/e2ewriter",
              newTab: true,
            },
          },
          {
            link: {
              type: "custom",
              label: "GitHub",
              url: "https://github.com/e2ewriter",
              newTab: true,
            },
          },
        ],
      },
      "e2e writer",
      ctx,
    )

    // Typography showcase article (slug: "rich-text-showcase").
    // Pass [] for mediaDocs — all media accesses use ?. so heroImage/meta.image will be null.
    const articleId = await createRichTextShowcaseArticle(
      payload,
      [writer],
      [],
      [],
      ctx,
      PUBLISHED_AT,
    )

    // Interactive map article (slug: "missouri-shifting-margins-119-120-congressional-maps").
    await createMoCongressionalMapsArticle(payload, [writer], [], [], ctx, PUBLISHED_AT)

    // The Federal Courts drilldown, as an interactive page (/interactives/federal-courts)
    // with a published data snapshot — what interactive-page.spec.ts drives.
    await createFederalCourtsInteractive(payload, ctx, PUBLISHED_AT)

    // A four-author article, so the byline's collapsed state has something to
    // render: two names and "& 2 more" beside two avatars and a "+2".
    //
    // Deliberately left off the homepage grid below. `gotoFirstArticle` follows
    // the first article link there and example.spec.ts screenshots the whole
    // page, so adding a tile would shift baselines that have nothing to do with
    // this article. byline.spec.ts navigates to it by slug instead.
    const coAuthors: User[] = []
    for (const coAuthor of CO_AUTHORS) {
      coAuthors.push(
        await createUser(
          payload,
          {
            email: coAuthor.email,
            password: "e2e-test-password-123",
            name: coAuthor.name,
            roles: ["writer"],
            slug: coAuthor.slug,
          },
          `e2e co-author ${coAuthor.name}`,
          ctx,
        ),
      )
    }

    // The only seeded article with narration, so article-meta-row.spec.ts can
    // photograph the hero's meta row carrying both controls. Kept on this
    // article rather than the homepage one so no existing baseline moves.
    const narration = await createSilentNarration(payload, NARRATION_SECONDS)

    await createArticle(
      payload,
      {
        title: "Committee Work: Notes From a Crowded Byline",
        slug: FOUR_AUTHOR_SLUG,
        narration,
        authors: [writer, ...coAuthors].map(({ id }) => id),
        content: createRichText([
          createParagraph(
            "Four authors, three slots. This article exists so the byline has somewhere to show its collapsed state — two names, a remainder, and an avatar stack that stops at the same place the names do.",
          ),
        ]),
        publishedAt: PUBLISHED_AT,
      },
      ctx,
    )

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
        publishedAt: PUBLISHED_AT,
      },
    })

    // One reused product image for the full-width Merch carousel below. See
    // createLocalMedia for why the e2e seed uploads a local file here.
    const merchImage = await createLocalMedia(
      payload,
      "public/android-chrome-512x512.png",
      "Pragmatic Papers merchandise",
    )

    // The catalogue merch.spec.ts exercises. Titles, prices, and the sold-out
    // badge match what the block used to carry inline, so the visual baseline
    // is unaffected by the move to synced products.
    await seedMerchProducts(
      payload,
      [
        {
          title: "Acid Washed Liberalism Charity Tee, Black",
          handle: "acid-washed-liberalism-tee-black",
          price: "100.00",
          imageId: merchImage,
          availableForSale: false,
          sortOrder: 0,
        },
        {
          title: "Liberalism Heavyweight Tee, Black",
          handle: "liberalism-heavyweight-tee-black",
          price: "40.00",
          imageId: merchImage,
          sortOrder: 1,
        },
        {
          title: "Liberalism Oversized Sweatshirt, Black",
          handle: "liberalism-oversized-sweatshirt-black",
          price: "65.00",
          imageId: merchImage,
          sortOrder: 2,
        },
        {
          title: "Liberalism Heavyweight Tee, Navy",
          handle: "liberalism-heavyweight-tee-navy",
          price: "40.00",
          imageId: merchImage,
          sortOrder: 3,
        },
        {
          title: "Liberalism Heavyweight Tee, White",
          handle: "liberalism-heavyweight-tee-white",
          price: "40.00",
          imageId: merchImage,
          sortOrder: 4,
        },
        {
          title: "Liberalism Oversized Sweatshirt, Navy",
          handle: "liberalism-oversized-sweatshirt-navy",
          price: "65.00",
          imageId: merchImage,
          sortOrder: 5,
        },
      ],
      ctx,
    )

    // Homepage with a CollectionGrid so gotoFirstArticle / gotoFirstVolume can
    // find a[href*="/articles/"] and a[href*="/volumes/"] links to follow.
    // A full-width Merch carousel ("Support The Papers") follows the grid so
    // merch.spec.ts has a deterministic block to exercise and screenshot;
    // autoplay stays off so the carousel never moves mid-capture.
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
          {
            blockType: "merch",
            blockName: "Support The Papers",
            heading: "Support The Papers",
            layout: "fullWidth",
            autoplay: false,
            // Every seeded product, in sort order — deterministic without
            // naming ids the page doesn't have yet.
            source: "all",
            orderBy: "sortOrder",
            limit: 6,
          },
        ],
      },
    })

    await payload.updateGlobal({
      slug: "footer",
      context: ctx,
      data: {
        layout: [
          {
            blockType: "content",
            width: "full",
            columns: [
              {
                size: "half",
                richText: createRichText([
                  createNewsletterSignupBlockNode({
                    heading: "Get Daily Pragmatic Papers",
                    description:
                      "When a new Volume drops, we send one article per weekday so you can actually read every piece. No spam, unsubscribe any time.",
                    buttonLabel: "Sign Up",
                    notice: createRichText([
                      createParagraph([
                        createTextNode(
                          "Your newsletter subscriptions are subject to The Pragmatic Papers ",
                        ),
                        createLinkNode("Privacy Policy", "/privacy-policy"),
                        createTextNode(" and "),
                        createLinkNode("Terms of Use", "/terms-of-use"),
                        createTextNode("."),
                      ]),
                    ]),
                  }),
                ]),
              },
              {
                size: "half",
                richText: createRichText([
                  createCTABlockNode({
                    richText: createRichText([
                      createHeadingNode("Stay up to date with The Pragmatic Papers", "h3"),
                      createParagraph(
                        "Get the latest articles, volumes, and updates delivered straight to you.",
                      ),
                    ]),
                    links: [
                      {
                        link: {
                          type: "custom",
                          url: "https://discord.gg/digitalgroundgame",
                          label: "Join the Community",
                          newTab: true,
                          appearance: "default",
                        },
                      },
                    ],
                  }),
                ]),
              },
            ],
          },
        ],
        copyright: {
          type: "custom",
          label: "Digital Ground Game",
          url: "https://digitalgroundgame.org",
          newTab: true,
        },
        navItems: [
          { link: { type: "custom", label: "Contact", url: "/contact" } },
          { link: { type: "custom", label: "About", url: "/about" } },
          { link: { type: "custom", label: "Privacy Policy", url: "/privacy-policy" } },
          { link: { type: "custom", label: "Terms of Use", url: "/terms-of-use" } },
          { link: { type: "custom", label: "Log In", url: "/admin/login" } },
        ],
        socials: [
          { link: { type: "custom", label: "X", url: "https://x.com/PragPapers", newTab: true } },
          {
            link: {
              type: "custom",
              label: "Instagram",
              url: "https://www.instagram.com/pragmaticpapers/",
              newTab: true,
            },
          },
          {
            link: {
              type: "custom",
              label: "Reddit",
              url: "https://www.reddit.com/user/ThePragmaticPapers/",
              newTab: true,
            },
          },
          {
            link: {
              type: "custom",
              label: "Bluesky",
              url: "https://bsky.app/profile/thepragmaticpapers.bsky.social",
              newTab: true,
            },
          },
          {
            link: {
              type: "custom",
              label: "Substack",
              url: "https://substack.com/@thepragmaticpapers",
              newTab: true,
            },
          },
        ],
      },
    })

    await pinRevisionStamps(payload)

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
