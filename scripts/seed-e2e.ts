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
import { getPayload } from "payload"

const ctx = { disableRevalidate: true }

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
        name: "E2E Writer",
        roles: ["writer"],
        slug: "e2e-writer",
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
