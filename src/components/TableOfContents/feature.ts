import { createServerFeature } from "@payloadcms/richtext-lexical"

/**
 * Lets the "Show table of contents" sidebar field set each heading's table of
 * contents label in this editor.
 */
export const TableOfContentsLabelsFeature = createServerFeature({
  feature: {
    ClientFeature: "@/components/TableOfContents/feature.client#TableOfContentsLabelsFeatureClient",
  },
  key: "tableOfContentsLabels",
})
