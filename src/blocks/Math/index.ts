import { spokenText } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"
import type { DisplayMathBlock, InlineMathBlock } from "@/payload-types"
import { describeVisual } from "@/utilities/describeVisual"

import {
  displayMathToCode,
  displayMathToHTML,
  inlineMathToCode,
  inlineMathToHTML,
} from "./converters"

// Narration never reads raw LaTeX aloud: it names the formula from the block's `description`
// when the author gave one.

export const displayMathBlock = defineBlock<DisplayMathBlock>({
  slug: "displayMathBlock",
  html: displayMathToHTML,
  // Substack's editor has no math: it keeps the LaTeX source.
  substack: displayMathToCode,
  narrate: (fields) => describeVisual("a mathematical formula", spokenText(fields.description)),
})

export const inlineMathBlock = defineBlock<InlineMathBlock>({
  slug: "inlineMathBlock",
  inline: true,
  html: inlineMathToHTML,
  substack: inlineMathToCode,
  // Inline within a sentence, the description reads as part of the surrounding clause, so it
  // is used bare rather than as a parenthetical aside.
  narrate: (fields) => spokenText(fields.description) || "a mathematical formula",
})
