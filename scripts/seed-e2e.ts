import { createMoCongressionalMapsArticle } from "@/endpoints/seed/features/interactive-maps"
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
import { createUser } from "@/endpoints/seed/users"
import config from "@payload-config"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { getPayload } from "payload"
import type { Payload } from "payload"

const ctx = { disableRevalidate: true }

// Create a media doc from a file already committed to the repo. The rest of the
// e2e seed deliberately ships no media (hero images resolve to null), but the
// Merch block's `image` field is required and the carousel screenshot needs
// something to render — so we upload one local PNG and reuse it across the
// products. Reading from disk keeps the seed deterministic and network-free,
// unlike `createMediaFromURL`.
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

// Screenshot baselines bake in this date via the article/volume byline, so it
// must stay fixed rather than tracking the day the seed happens to run.
const PUBLISHED_AT = "2026-06-04T00:00:00.000Z"

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
            storeUrl: "https://store.digitalgroundgame.org/",
            products: [
              {
                image: merchImage,
                title: "Acid Washed Liberalism Charity Tee, Black",
                price: "$100.00",
                badge: "Sold Out",
                url: "https://store.digitalgroundgame.org/products/acid-washed-liberalism-tee-black",
              },
              {
                image: merchImage,
                title: "Liberalism Heavyweight Tee, Black",
                price: "$40.00",
                url: "https://store.digitalgroundgame.org/products/liberalism-heavyweight-tee-black",
              },
              {
                image: merchImage,
                title: "Liberalism Oversized Sweatshirt, Black",
                price: "$65.00",
                url: "https://store.digitalgroundgame.org/products/liberalism-oversized-sweatshirt-black",
              },
              {
                image: merchImage,
                title: "Liberalism Heavyweight Tee, Navy",
                price: "$40.00",
                url: "https://store.digitalgroundgame.org/products/liberalism-heavyweight-tee-black",
              },
              {
                image: merchImage,
                title: "Liberalism Heavyweight Tee, White",
                price: "$40.00",
                url: "https://store.digitalgroundgame.org/products/liberalism-heavyweight-tee-black-copy",
              },
              {
                image: merchImage,
                title: "Liberalism Oversized Sweatshirt, Navy",
                price: "$65.00",
                url: "https://store.digitalgroundgame.org/products/liberalism-oversized-sweatshirt-navy",
              },
            ],
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
