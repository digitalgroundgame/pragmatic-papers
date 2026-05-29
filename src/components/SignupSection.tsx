import { CallToActionBlock } from "@/blocks/CallToAction/Component"
import { NewsletterSignupBlock } from "@/blocks/NewsletterSignup/Component"
import { createHeadingNode, createParagraph, createRichText } from "@/utilities/lexical"
import React from "react"

const CTA_RICH_TEXT = createRichText([
  createHeadingNode("Stay up to date with The Pragmatic Papers", "h3"),
  createParagraph("Get the latest articles, volumes, and updates delivered straight to you."),
])

const CTA_LINKS = [
  {
    link: {
      type: "custom" as const,
      url: "https://discord.gg/digitalgroundgame",
      label: "Join the Community",
      newTab: true,
      appearance: "default" as const,
    },
  },
]

export function SignupSection(): React.ReactNode {
  return (
    <section className="container mt-6">
      <div className="grid grid-cols-1 gap-8 border-t pt-6 md:grid-cols-2">
        <NewsletterSignupBlock blockType="newsletterSignup" />
        <CallToActionBlock blockType="cta" richText={CTA_RICH_TEXT} links={CTA_LINKS} />
      </div>
    </section>
  )
}
