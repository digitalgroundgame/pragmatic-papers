import React from "react"

import type { CodeBlock as CodeBlockType } from "@/payload-types"
import { cn } from "@/utilities/utils"
import { Code } from "./Component.client"

type Props = CodeBlockType & {
  className?: string
}

export const CodeBlock: React.FC<Props> = ({ className, code, language, description }) => {
  return (
    <div
      className={cn("not-prose", className)}
      role={description ? "region" : undefined}
      aria-label={description ?? undefined}
    >
      <Code code={code} language={language ?? "typescript"} />
    </div>
  )
}
