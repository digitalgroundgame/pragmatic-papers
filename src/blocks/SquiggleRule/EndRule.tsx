import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import React from "react"

import { Squiggle } from "@/components/ui/squiggle"

const endsWithSquiggle = (content: DefaultTypedEditorState | null | undefined): boolean => {
  const last = content?.root?.children?.at(-1) as
    { type?: string; fields?: { blockType?: string } } | undefined
  return last?.type === "block" && last.fields?.blockType === "squiggleRule"
}

/**
 * The squiggle that closes an article or a help doc, as the house sign-off. Left out when the
 * writer already ended the piece with a Squiggle Rule block, so there's never two in a row.
 */
export function EndRule({
  content,
  className,
}: {
  content: DefaultTypedEditorState | null | undefined
  className?: string
}): React.ReactNode {
  if (endsWithSquiggle(content)) return null
  return <Squiggle className={className} size="small" />
}
