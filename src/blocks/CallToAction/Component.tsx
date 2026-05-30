import React from "react"

import type { CallToActionBlock as CTABlockProps } from "@/payload-types"

import { CMSLink } from "@/components/Link"
import { PaperIcon } from "@/components/Logo/icons/PaperIcon"
import { PaperIconPattern } from "@/components/Logo/icons/PaperIconPattern"
import RichText from "@/components/RichText"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/utilities/utils"

export const CallToActionBlock: React.FC<CTABlockProps> = ({ id, links, richText }) => {
  return (
    <div className="dark container">
      <div className="from-brand to-brand/50 relative flex flex-col items-center gap-8 rounded-sm border bg-black bg-[linear-gradient(180deg,var(--tw-gradient-from),var(--tw-gradient-to))] px-8 py-16 shadow-2xl md:flex-row md:items-center md:justify-around lg:gap-16 lg:px-16">
        <PaperIconPattern
          id={`paper-icon-pattern-${id}`}
          className="absolute inset-0 h-full w-full text-white opacity-5 blur-xs"
        />
        <div className="relative">
          <PaperIcon className="absolute top-1 size-30 text-black/30 blur md:size-40" />
          <PaperIcon className="relative z-1 size-30 text-white md:size-40" />
        </div>
        <div className="relative mr-auto flex max-w-3xl items-center gap-6">
          {richText && (
            <RichText
              className="prose-headings:font-sans prose-headings:mb-3 prose-headings:text-white mb-0 text-white"
              data={richText}
              enableGutter={false}
            />
          )}
        </div>
        <div className="relative flex flex-col gap-8">
          {(links || []).map(({ link }, i) => {
            return (
              <CMSLink
                key={i}
                size="lg"
                className={cn(buttonVariants({ variant: "secondary" }), "[a]:hover:bg-black")}
                {...link}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
