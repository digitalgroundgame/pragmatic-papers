import { CMSLink } from "@/components/Link"
import type { FootnotesField } from "@/payload-types"
import { linkHref } from "@/utilities/linkField"
import { getClientURL } from "@/utilities/getURL"
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
          const url = linkHref(link)
          return (
            <li key={index}>
              <span id={`footnote-${index}`} className="mr-1">
                {note}
              </span>
              {attributionEnabled && (
                <CMSLink
                  link={link}
                  className="text-brand-text text-sm wrap-break-word underline shadow-none"
                >
                  {link?.type === "reference" ? `${getClientURL()}${url}` : url}
                </CMSLink>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
