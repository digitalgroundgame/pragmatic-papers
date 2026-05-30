"use client"

import { cn } from "@/utilities/utils"
import * as React from "react"

const sizeClasses = {
  small: "max-w-xs",
  medium: "max-w-md",
  large: "max-w-lg",
  full: "w-full",
}

type Size = keyof typeof sizeClasses

interface SquiggleProps {
  className?: string
  size?: Size
}

const SquiggleStatic: React.FC<SquiggleProps> = ({ className, size = "small" }) => {
  return (
    <div className={cn("mx-auto my-8", sizeClasses[size], className)}>
      <div
        className={cn(
          "relative block h-1 w-full bg-[url(/squiggle-static.svg)] bg-size-[auto_4px] bg-position-[left_calc(100%)_top_calc(100%)] bg-repeat-x",
        )}
      />
    </div>
  )
}

const Squiggle: React.FC<SquiggleProps> = ({ className, size = "small" }) => {
  return (
    <div className={cn("mx-auto my-8", sizeClasses[size], className)}>
      <div
        className={cn(
          "relative block h-1 w-full bg-[url(/squiggle.svg)] bg-size-[auto_4px] bg-position-[left_calc(100%)_top_calc(100%)] bg-repeat-x",
        )}
      />
    </div>
  )
}

export { Squiggle, SquiggleStatic }
