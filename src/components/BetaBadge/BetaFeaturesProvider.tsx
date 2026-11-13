"use client"

import React, { createContext, useContext } from "react"

import type { BetaFeature, BetaFeatures } from "@/data/betaFeatures"

const BetaFeaturesContext = createContext<BetaFeatures>({})

/** Hands every page the site's beta features, which a layout reads once (`getBetaFeatures`). */
export function BetaFeaturesProvider({
  features,
  children,
}: {
  features: BetaFeatures
  children: React.ReactNode
}): React.ReactNode {
  return <BetaFeaturesContext.Provider value={features}>{children}</BetaFeaturesContext.Provider>
}

/** What the flask says about `feature`, or `undefined` once it's no longer a beta. */
export function useBetaInfo(feature: BetaFeature): string | undefined {
  return useContext(BetaFeaturesContext)[feature]
}
