import type { BannerBlock as BannerBlockProps } from "src/payload-types"

import RichText from "@/components/RichText"
import { cn } from "@/utilities/utils"
import React from "react"

type Props = {
  className?: string
} & BannerBlockProps

export const BannerBlock: React.FC<Props> = ({ className, content, style }) => {
  return (
    <RichText
      className={cn(
        "mx-auto my-8 flex w-full items-center rounded-sm border px-6 py-3",
        {
          "border-border bg-card": style === "info",
          "border-error bg-error/30": style === "error",
          "border-success bg-success/30": style === "success",
          "border-warning bg-warning/30": style === "warning",
        },
        className,
      )}
      data={content}
      enableGutter={false}
      enableProse={false}
    />
  )
}
