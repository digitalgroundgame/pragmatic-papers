import type {
  DisplayMathBlock as DisplayMathBlockProps,
  InlineMathBlock as InlineMathBlockProps,
} from "@/payload-types"
import { MathJax } from "better-react-mathjax/esm"
import React from "react"

export type MathBlockProps = (InlineMathBlockProps | DisplayMathBlockProps) & {
  blockType: "inlineMathBlock" | "displayMathBlock"
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

  if (isInline) {
    if (description) {
      return (
        <span aria-label={description}>
          <span aria-hidden="true">{content}</span>
        </span>
      )
    }
    return content
  }

  if (description) {
    return (
      <div role="region" aria-label={description}>
        <div aria-hidden="true">{content}</div>
      </div>
    )
  }

  return content
}
