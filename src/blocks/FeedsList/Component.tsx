import React from "react"

import type { FeedsListBlock as FeedsListBlockProps } from "@/payload-types"

import { getSiteURL } from "@/utilities/getURL"

import { feedLinks } from "./links"

export const FeedsListBlock: React.FC<FeedsListBlockProps> = ({ list, title, description }) => {
  const siteUrl = getSiteURL()
  return (
    <section aria-label={title || undefined} className="container my-8 max-w-3xl space-y-3">
      {title && <h2>{title}</h2>}
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
      <ul className="divide-y border-y">
        {feedLinks(list).map((link) => (
          <li key={link.path} className="space-y-1 py-3">
            {/* Plain links: these are XML files, not pages to prefetch. */}
            <a href={link.path} className="font-medium hover:underline">
              {link.title}
            </a>
            {link.description && (
              <p className="text-muted-foreground text-sm">{link.description}</p>
            )}
            <p className="text-muted-foreground font-mono text-xs break-all">
              {siteUrl}
              {link.path}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
