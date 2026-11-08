import { defineBlock } from "@/blocks/types"
import type { SquiggleRuleBlock } from "@/payload-types"

import { squiggleRuleToHTML } from "./converters"

export const squiggleRuleBlock = defineBlock<SquiggleRuleBlock>({
  slug: "squiggleRule",
  html: squiggleRuleToHTML,
  // A rule is decoration: narration leaves it out, as it does a horizontal rule.
  narrate: () => "",
})
