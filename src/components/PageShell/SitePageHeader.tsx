import React from "react"

import RichText from "@/components/RichText"
import { hasH1 } from "@/heros/RenderHero"
import type { Page } from "@/payload-types"

import { PageHeader } from "."

/**
 * A site page's header, in the shell's header frame: the page's hero text when it has some,
 * else its title (and the route's own line under it, for a page that isn't there yet).
 */
export function SitePageHeader({
  hero,
  title,
  description,
}: {
  hero?: Page["hero"] | null
  title: string
  /** The line under the title while the route has no page to read. */
  description?: string
}): React.ReactNode {
  if (!hero) return <PageHeader title={title} description={description} />
  if (hero.type === "none" || !hero.richText) return <PageHeader title={title} />

  return (
    <header className="[&_p]:text-muted-foreground max-w-2xl space-y-3 group-data-[align=center]/page:mx-auto">
      {!hasH1(hero.richText) && <h1 className="sr-only">{title}</h1>}
      <RichText data={hero.richText} enableGutter={false} enableProse={false} />
    </header>
  )
}
