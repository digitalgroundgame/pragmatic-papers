import { CMSLink } from "@/components/Link/CMSLink2"
import type { FootnotesField } from "@/payload-types"
import { getLinkFieldUrl } from "@/utilities/getLinkFieldUrl"
import { getClientSideURL } from "@/utilities/getURL"
import React from "react"

interface FootnoteListProps {
  footnotes?: FootnotesField
}

export const FootnoteList: React.FC<FootnoteListProps> = ({ footnotes }) => {
  if (!footnotes || !footnotes.length) return null
  return (
    <section className="space-y-2">
      <h2>Sources</h2>
      <ol className="list-inside list-decimal font-serif">
        {footnotes.map(({ index, note, attributionEnabled, link }) => {
          const url = getLinkFieldUrl(link)
          return (
            <li key={index}>
              <span id={`footnote-${index}`} className="mr-1">
                {note}
              </span>
              {attributionEnabled && (
                <CMSLink
                  link={link}
                  className="text-brand dark:text-brand-high-contrast text-sm wrap-break-word underline shadow-none"
                >
                  {link?.type === "reference" ? `${getClientSideURL()}${url}` : url}
                </CMSLink>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
