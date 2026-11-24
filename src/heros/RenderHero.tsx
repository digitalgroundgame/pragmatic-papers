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

type HeroProps = Page["hero"] & {
  /**
   * The page's title, for a page whose hero doesn't open with its own h1 (no hero, or rich
   * text without an h1 heading): it becomes a visually hidden h1, so the page still has one
   * for screen readers and search engines.
   */
  title?: string | null
}

/** Whether a Lexical document holds a top-level h1 heading. */
export function hasH1(richText: Page["hero"]["richText"]): boolean {
  return (richText?.root?.children ?? []).some(
    (node) => node.type === "heading" && (node as { tag?: string }).tag === "h1",
  )
}

export const RenderHero: React.FC<HeroProps> = ({ title, ...props }) => {
  const { type } = props || {}
  const HeroToRender = type && type !== "none" ? heroes[type] : undefined
  const hiddenTitle = title && !(HeroToRender && hasH1(props.richText)) ? title : null

  return (
    <>
      {hiddenTitle && <h1 className="sr-only">{hiddenTitle}</h1>}
      {HeroToRender && <HeroToRender {...props} />}
    </>
  )
}
