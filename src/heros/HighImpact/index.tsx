import React from "react"

import type { Page } from "@/payload-types"

import { CMSLink } from "@/components/Link"
import { Media } from "@/components/Media"
import RichText from "@/components/RichText"

export const HighImpactHero: React.FC<Page["hero"]> = ({ links, media, richText }) => {
  return (
    <div
      className="relative -mt-[10.4rem] flex items-center justify-center text-white"
      data-theme="dark"
    >
      <div className="relative z-10 container mb-8 flex items-center justify-center">
        <div className="max-w-146 md:text-center">
          {richText && <RichText className="mb-6" data={richText} enableGutter={false} />}
          {Array.isArray(links) && links.length > 0 && (
            <ul className="flex gap-4 md:justify-center">
              {links.map(({ link }, i) => {
                return (
                  <li key={i}>
                    <CMSLink {...link} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
      {media && typeof media === "object" && (
        <div className="min-h-[80vh] select-none">
          <Media
            fill
            className="-z-10 object-cover"
            priority
            sizes="100vw"
            media={media}
            variant="xlarge"
          />
        </div>
      )}
    </div>
  )
}
