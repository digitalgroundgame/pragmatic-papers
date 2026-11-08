import { bannerPicker } from "@/blocks/Banner/picker"
import { ctaPicker } from "@/blocks/CallToAction/picker"
import { codePicker } from "@/blocks/Code/picker"
import { collectionGridPicker } from "@/blocks/CollectionGrid/picker"
import { contentPicker } from "@/blocks/Content/picker"
import { contributorsPicker } from "@/blocks/Contributors/picker"
import { feedsListPicker } from "@/blocks/FeedsList/picker"
import { footnotePicker } from "@/blocks/Footnote/picker"
import { formPicker } from "@/blocks/Form/picker"
import { interactiveMapPicker } from "@/blocks/InteractiveMap/picker"
import { displayMathPicker, inlineMathPicker } from "@/blocks/Math/picker"
import { mediaBlockPicker } from "@/blocks/MediaBlock/picker"
import { mediaCollagePicker } from "@/blocks/MediaCollageBlock/picker"
import { merchPicker } from "@/blocks/Merch/picker"
import { newsletterSignupPicker } from "@/blocks/NewsletterSignup/picker"
import { legacyEmbedPickers, socialEmbedPicker } from "@/blocks/SocialEmbed/picker"
import { squiggleRulePicker } from "@/blocks/SquiggleRule/picker"
import { timelinePicker } from "@/blocks/Timeline/picker"
import { volumeViewPicker } from "@/blocks/VolumeViewBlock/picker"

import type { BlockPicker } from "./shapes"

/**
 * Every block's picker images, by slug, as each block's `picker.tsx` draws them. Only
 * `pnpm block-images`, its test and the story read this: the admin loads the rendered files.
 * `registry.test.ts` fails until it holds exactly the slugs in `BLOCKS`.
 */
export const PICKERS: Record<string, BlockPicker> = {
  banner: bannerPicker,
  code: codePicker,
  collectionGrid: collectionGridPicker,
  content: contentPicker,
  contributors: contributorsPicker,
  cta: ctaPicker,
  displayMathBlock: displayMathPicker,
  feedsList: feedsListPicker,
  footnote: footnotePicker,
  formBlock: formPicker,
  inlineMathBlock: inlineMathPicker,
  interactiveMap: interactiveMapPicker,
  mediaBlock: mediaBlockPicker,
  mediaCollage: mediaCollagePicker,
  merch: merchPicker,
  newsletterSignup: newsletterSignupPicker,
  socialEmbed: socialEmbedPicker,
  ...legacyEmbedPickers,
  squiggleRule: squiggleRulePicker,
  timeline: timelinePicker,
  volumeView: volumeViewPicker,
}
