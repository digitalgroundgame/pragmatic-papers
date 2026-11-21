import { narrateAs } from "@/blocks/narration"
import { defineBlock } from "@/blocks/types"

export const newsletterSignupBlock = defineBlock({
  slug: "newsletterSignup",
  picker: () => import("./picker"),
  narrate: narrateAs("newsletter signup"),
})
