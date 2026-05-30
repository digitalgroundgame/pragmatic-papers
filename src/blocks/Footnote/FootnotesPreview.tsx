"use client"

import type { FootnotesField } from "@/payload-types"
import { useDocumentInfo } from "@payloadcms/ui"
import React from "react"

export const FootnotesPreview: React.FC = () => {
  const { data } = useDocumentInfo()

  const footnotes = (data?.footnotes as NonNullable<FootnotesField>) ?? []

  if (!footnotes.length) return null

  return (
    <div className="field-type">
      <div className="label-wrapper">
        <p className="field-label">Footnotes</p>
      </div>
      <ol
        style={{
          margin: 0,
          paddingLeft: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {footnotes.map((footnote, i) => (
          <li key={footnote.id ?? i}>
            {footnote.note}
            {footnote.attributionEnabled && footnote.link?.url && (
              <>
                {" — "}
                <a
                  href={footnote.link.url}
                  target={footnote.link.newTab ? "_blank" : undefined}
                  rel={footnote.link.newTab ? "noopener noreferrer" : undefined}
                  style={{ textDecoration: "underline" }}
                >
                  {footnote.link.url}
                </a>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
