import { footnoteFields } from "@/fields/footnotes"
import type { Block } from "payload"

export const FootnoteBlock: Block = {
  slug: "footnote",
  interfaceName: "FootnoteBlock",
  fields: [
    {
      name: "sourceId",
      type: "text",
      admin: {
        hidden: true,
        description: "The Optional ID of an existing footnote to link to. Hidden in the admin UI.",
      },
    },
    {
      name: "referenceNotice",
      type: "ui",
      admin: {
        condition: (_, siblingData) => Boolean(siblingData?.sourceId),
        components: {
          Field: "@/blocks/Footnote/ReferenceNotice#ReferenceNotice",
        },
      },
    },
    ...footnoteFields({
      component: {
        note: {
          admin: {
            components: {
              Field: "@/blocks/Footnote/NoteField#NoteField",
            },
          },
        },
        attributionEnabled: {
          admin: {
            condition: (_, s) => !s?.sourceId,
          },
        },
        link: {
          admin: {
            condition: (_, s) => !s?.sourceId && Boolean(s?.attributionEnabled),
          },
        },
      },
    }),
    {
      name: "insertExistingFootnote",
      type: "ui",
      admin: {
        condition: (_, s) => !s?.sourceId && !s?.note,
        components: {
          Field: "@/blocks/Footnote/InsertExistingFootnote#InsertExistingFootnote",
        },
      },
    },
  ],
  graphQL: {
    singularName: "FootnoteBlock",
  },
  labels: {
    singular: "Footnote",
    plural: "Footnotes",
  },
  admin: {
    components: {
      Label: "@/blocks/Footnote/FootnoteLabel#FootnoteLabel",
    },
  },
}
