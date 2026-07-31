import React from "react"

import type { CodeBlock as CodeBlockType } from "@/payload-types"
import { cn } from "@/utilities/utils"
import { Code } from "./Component.client"

type Props = CodeBlockType & {
  className?: string
}

export const CodeBlock: React.FC<Props> = ({ className, code, language }) => {
  return (
    <div className={cn("not-prose", className)}>
      <Code code={code} language={language ?? "typescript"} />
    </div>
  )
}
