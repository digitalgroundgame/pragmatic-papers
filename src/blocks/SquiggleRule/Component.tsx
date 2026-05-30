import type { SquiggleRuleBlock as SquiggleRuleBlockProps } from "src/payload-types"

import React from "react"
import { Squiggle, SquiggleStatic } from "@/components/ui/squiggle"

type Props = {
  className?: string
} & SquiggleRuleBlockProps

export const SquiggleRuleBlock: React.FC<Props> = ({ className, variant, size }) => {
  const SquiggleComponent = variant === "static" ? SquiggleStatic : Squiggle

  return <SquiggleComponent className={className} size={size || "medium"} />
}
