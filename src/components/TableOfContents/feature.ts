import { createServerFeature } from "@payloadcms/richtext-lexical"

/**
 * A box under the heading the cursor is in, for a shorter label to list it by
 * in the table of contents.
 */
export const TableOfContentsLabelsFeature = createServerFeature({
  feature: {
    ClientFeature: "@/components/TableOfContents/feature.client#TableOfContentsLabelsFeatureClient",
  },
  key: "tableOfContentsLabels",
})
