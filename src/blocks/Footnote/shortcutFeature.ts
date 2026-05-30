import { createServerFeature } from "@payloadcms/richtext-lexical"

export const FootnoteShortcutFeature = createServerFeature({
  feature: {
    ClientFeature: "@/blocks/Footnote/shortcutFeature.client#FootnoteShortcutFeatureClient",
  },
  key: "footnoteShortcut",
})
