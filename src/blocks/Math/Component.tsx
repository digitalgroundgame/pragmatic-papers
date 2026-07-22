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
    return (
      <span role="text" aria-label={description ?? undefined}>
        <span aria-hidden={description ? "true" : undefined}>{content}</span>
      </span>
    )
  }

  return (
    <div role="region" aria-label={description ?? undefined}>
      <div aria-hidden={description ? "true" : undefined}>{content}</div>
    </div>
  )
}
