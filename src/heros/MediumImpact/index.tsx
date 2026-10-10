import React from "react"

import type { Page } from "@/payload-types"

import { CMSButton } from "@/components/Button"
import { Media } from "@/components/Media"
import RichText from "@/components/RichText"

export const MediumImpactHero: React.FC<Page["hero"]> = ({ links, media, richText }) => {
  return (
    <div className="">
      <div className="container mb-8">
        <RichText className="mb-6" data={richText} enableGutter={false} />

        {Array.isArray(links) && links.length > 0 && (
          <ul className="flex gap-4">
            {links.map(({ link }, i) => {
              return (
                <li key={i}>
                  <CMSButton link={link} variant={link?.variant ?? "default"} />
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className="container">
        {media && typeof media === "object" && (
          <div className="-mx-5 md:-mx-8 lg:-mx-16 xl:-mx-32">
            <Media media={media} sizes="(max-width: 768px) 100vw, 1024px" variant="large" preload />
            {media?.caption && (
              <div className="mt-3">
                <RichText data={media.caption} enableGutter={false} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
