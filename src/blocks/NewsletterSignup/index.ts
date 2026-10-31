import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const newsletterSignupBlock = defineBlock({
  slug: "newsletterSignup",
  narrate: narrateAs("newsletter signup"),
})
