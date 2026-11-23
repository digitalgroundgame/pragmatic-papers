import type { Decorator } from "@storybook/nextjs-vite"
import React from "react"

import { BetaFeaturesProvider } from "@/components/BetaBadge"
import type { BetaFeatures } from "@/data/betaFeatures"

/** The beta features a site has today, as the layout hands them to its pages. */
export const betaFeatures: BetaFeatures = {
  comments: "Comments are in beta: we're still trying them out, so they may change.",
  sso: "Accounts are in beta: we're still trying them out, so they may change.",
  achievements: "Achievements are in beta: we're still trying them out, so they may change.",
  interactives: "Interactive pages are in beta: we're still trying them out, so they may change.",
}

/** Wraps a story in the layout's beta features (`features`, or today's). */
export function withBetaFeatures(features: BetaFeatures = betaFeatures): Decorator {
  return function WithBetaFeatures(Story) {
    return (
      <BetaFeaturesProvider features={features}>
        <Story />
      </BetaFeaturesProvider>
    )
  }
}
