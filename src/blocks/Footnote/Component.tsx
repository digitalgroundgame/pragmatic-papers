import type { FootnoteBlock as FootnoteBlockType } from "@/payload-types"
import { cn } from "@/utilities/utils"
import React from "react"

interface FootnoteBlockProps extends FootnoteBlockType {
  className?: string
}

export const FootnoteBlock: React.FC<FootnoteBlockProps> = ({ note, index, className }) => {
  if (!note || typeof index !== "number") return null

  const referenceId = `footnote-ref-${index}`
  const describedById = `footnote-${index}`

  return (
    <sup
      id={referenceId}
      className={cn(className, "not-prose px-0.5 font-mono -tracking-widest")}
      title={`Footnote ${index}: ${note}`}
    >
      <a
        className="text-brand dark:text-brand-high-contrast font-semibold underline-offset-6 hover:underline"
        href={`#${describedById}`}
        aria-describedby={describedById}
      >
        {`[${index}]`}
      </a>
    </sup>
  )
}
