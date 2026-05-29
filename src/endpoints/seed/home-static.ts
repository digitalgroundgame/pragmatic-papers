import type { RequiredDataFromCollectionSlug } from "payload"

import {
  createCTABlockNode,
  createHeadingNode,
  createLinkNode,
  createNewsletterSignupBlockNode,
  createParagraph,
  createRichText,
  createTextNode,
} from "./richtext"

// Used for pre-seeded content so that the homepage is not empty
export const homeStatic: RequiredDataFromCollectionSlug<"pages"> = {
  title: "Home",
  hero: {
    type: "pageHero",
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
                text: "Home",
                type: "text",
                version: 1,
              },
            ],
            direction: "ltr" as const,
            format: "" as const,
            indent: 0,
            tag: "h1",
            type: "heading",
            version: 1,
          },
        ],
        direction: "ltr" as const,
        format: "" as const,
        indent: 0,
        type: "root",
        version: 1,
      },
    },
    links: [],
    media: null,
  },
  layout: [
    {
      blockType: "content",
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
          enableLink: false,
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
                    label: "Join Us",
                    newTab: true,
                    appearance: "default",
                  },
                },
              ],
            }),
          ]),
          enableLink: false,
        },
      ],
    },
  ],
  meta: {
    title: "Home",
    image: null,
    description: "Home",
  },
  publishedAt: "2025-07-09T07:54:37.358Z",
  slug: "home",
  generateSlug: true,
  updatedAt: "2025-07-13T23:32:37.273Z",
  createdAt: "2025-07-09T07:54:36.604Z",
  _status: "published",
}
