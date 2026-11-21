import { defineBlock } from "@/blocks/types"
import type { FootnoteBlock } from "@/payload-types"

import { footnoteToHTML } from "./converters"

export const footnoteBlock = defineBlock<FootnoteBlock>({
  slug: "footnote",
  picker: () => import("./picker"),
  inline: true,
  html: footnoteToHTML,
  // Footnotes aren't read aloud.
  narrate: () => "",
})
