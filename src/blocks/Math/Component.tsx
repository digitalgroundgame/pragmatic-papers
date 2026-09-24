import React from "react"

import { MathJax } from "better-react-mathjax/esm"

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
    <MathJax key={math} inline>
      \({math}\)
    </MathJax>
  ) : (
    <div className="my-4 flex justify-center">
      <MathJax key={math}>\[{math}\]</MathJax>
    </div>
  )

  // Without a description a screen reader is left to announce the rendered
  // LaTeX, so only swap in the label when the author actually named the
  // formula. `role="math"` makes the label replace the MathJax markup rather
  // than being read alongside it.
  if (!description) return content

  const Wrapper = isInline ? "span" : "div"

  return (
    <Wrapper role="math" aria-label={description}>
      <Wrapper aria-hidden="true">{content}</Wrapper>
    </Wrapper>
  )
}
