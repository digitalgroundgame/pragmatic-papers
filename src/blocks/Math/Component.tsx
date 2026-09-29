import React from "react"

import { TypesetMath } from "./TypesetMath"

export interface MathBlockProps {
  math: string
  blockType: "inlineMathBlock" | "displayMathBlock"
  description?: string | null
}

export const MathBlock: React.FC<MathBlockProps> = (props) => {
  const { math, blockType, description } = props

  if (!math) return null

  const isInline = blockType === "inlineMathBlock"

  const content = isInline ? (
    <TypesetMath key={math} inline>
      \({math}\)
    </TypesetMath>
  ) : (
    <div className="my-4 flex justify-center">
      <TypesetMath key={math}>\[{math}\]</TypesetMath>
    </div>
  )

  // Without a description a screen reader is left to announce the rendered
  // LaTeX, so only swap in the label when the author actually named the
  // formula. `role="math"` makes the label replace the MathJax markup rather
  // than being read alongside it. `inert` keeps MathJax's focusable container
  // out of the tab order, or keyboard users land on content screen readers skip.
  if (!description) return content

  const Wrapper = isInline ? "span" : "div"

  return (
    <Wrapper role="math" aria-label={description}>
      <Wrapper aria-hidden="true" inert>
        {content}
      </Wrapper>
    </Wrapper>
  )
}
