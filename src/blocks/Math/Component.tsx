import React from "react"

import { MathJax } from "better-react-mathjax/esm"

export interface MathBlockProps {
  math: string
  blockType: "inlineMathBlock" | "displayMathBlock"
}

export const MathBlock: React.FC<MathBlockProps> = (props) => {
  const { math, blockType } = props

  if (!math) return null

  const isInline = blockType === "inlineMathBlock"

  return (
    <>
      {isInline ? (
        <MathJax key={math} inline>
          \({math}\)
        </MathJax>
      ) : (
        <div className="my-4 flex justify-center">
          <MathJax key={math}>\[{math}\]</MathJax>
        </div>
      )}
    </>
  )
}
