import { spokenText } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"
import type { CodeBlock } from "@/payload-types"
import { describeVisual } from "@/utilities/describeVisual"

import { codeToHTML } from "./converters"

export const codeBlock = defineBlock<CodeBlock>({
  slug: "code",
  html: codeToHTML,
  narrate: (fields) => {
    const language = spokenText(fields.language)
    return describeVisual(language ? `a code sample in ${language}` : "a code sample")
  },
})
