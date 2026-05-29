import type { RequiredDataFromCollectionSlug } from "payload"

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
          size: "full",
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
                      text: "This site has no content yet. ",
                      type: "text",
                      version: 1,
                    },
                    {
                      children: [
                        {
                          detail: 0,
                          format: 0,
                          mode: "normal",
                          style: "",
                          text: "Seed the database from the admin",
                          type: "text",
                          version: 1,
                        },
                      ],
                      direction: "ltr" as const,
                      fields: {
                        linkType: "custom" as const,
                        newTab: false,
                        url: "/admin",
                      },
                      format: "" as const,
                      indent: 0,
                      type: "link" as const,
                      version: 1,
                    },
                    {
                      detail: 0,
                      format: 0,
                      mode: "normal",
                      style: "",
                      text: ".",
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
