import { defineBlock } from "@/blocks/types"
import type { FootnoteBlock } from "@/payload-types"

import { footnoteToHTML } from "./converters"

export const footnoteBlock = defineBlock<FootnoteBlock>({
  slug: "footnote",
  inline: true,
  html: footnoteToHTML,
  // Footnotes aren't read aloud.
  narrate: () => "",
})
