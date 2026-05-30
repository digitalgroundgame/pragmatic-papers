import React from "react"

import type { Page } from "@/payload-types"

import { HighImpactHero } from "@/heros/HighImpact"
import { LowImpactHero } from "@/heros/LowImpact"
import { MediumImpactHero } from "@/heros/MediumImpact"
import { PageHero } from "@/heros/PageHero"

const heroes = {
  highImpact: HighImpactHero,
  lowImpact: LowImpactHero,
  mediumImpact: MediumImpactHero,
  pageHero: PageHero,
}

export const RenderHero: React.FC<Page["hero"]> = (props) => {
  const { type } = props || {}

  if (!type || type === "none") return null

  const HeroToRender = heroes[type]

  if (!HeroToRender) return null

  return <HeroToRender {...props} />
}
