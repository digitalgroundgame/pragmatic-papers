import React from "react"

import "./DocDiff.css"

export interface DocDiffProps {
  /** A unified diff's hunks, as `diffDocSource` writes them. */
  diff: string
}

const kind = (line: string): "added" | "removed" | "hunk" | "context" =>
  line.startsWith("@@")
    ? "hunk"
    : line.startsWith("+")
      ? "added"
      : line.startsWith("-")
        ? "removed"
        : "context"

const LABELS = { added: "Added", removed: "Removed" } as const

/**
 * What changed in a doc's Markdown, line by line: added lines green, removed lines red, each
 * labelled for screen readers, with a few unchanged lines around them for context.
 */
export const DocDiff: React.FC<DocDiffProps> = ({ diff }) => {
  if (!diff.trim()) {
    return <p className="doc-diff__empty">The doc&rsquo;s text didn&rsquo;t change.</p>
  }
  return (
    <pre className="doc-diff" aria-label="Changes to the doc">
      {diff.split("\n").map((line, i) => {
        const type = kind(line)
        if (type === "hunk") {
          const start = /\+(\d+)/.exec(line)?.[1]
          return (
            <span key={i} className="doc-diff__line doc-diff__line--hunk">
              {start ? `Line ${start}` : line}
            </span>
          )
        }
        return (
          <span key={i} className={`doc-diff__line doc-diff__line--${type}`}>
            {type === "context" ? null : <span className="doc-diff__sr">{LABELS[type]}: </span>}
            <span aria-hidden="true" className="doc-diff__mark">
              {type === "added" ? "+" : type === "removed" ? "−" : " "}
            </span>
            {line.slice(1)}
          </span>
        )
      })}
    </pre>
  )
}
