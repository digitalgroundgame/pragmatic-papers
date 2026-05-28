import React from "react"

import type { CallToActionBlock as CTABlockProps } from "@/payload-types"

import { CMSLink } from "@/components/Link/CMSLink2"
import { PaperIcon } from "@/components/Logo/icons/PaperIcon"
import { PaperIconPattern } from "@/components/Logo/icons/PaperIconPattern"
import RichText from "@/components/RichText"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/utilities/utils"

export const CallToActionBlock: React.FC<CTABlockProps> = ({ id, links, richText }) => {
  return (
    <div className="dark from-brand to-brand/50 relative mx-4 flex flex-col items-center gap-6 rounded-sm bg-black bg-[linear-gradient(180deg,var(--tw-gradient-from),var(--tw-gradient-to))] px-8 py-8 font-sans shadow-2xl md:mx-0 md:flex-row md:items-start">
      <PaperIconPattern
        id={`paper-icon-pattern-${id}`}
        className="absolute inset-0 z-0 h-full w-full text-white opacity-5 blur-[1px]"
      />
      <div className="relative m-7 aspect-square size-32 -translate-y-3">
        <PaperIcon className="absolute top-1 text-black/30 blur" />
        <PaperIcon className="relative z-1 text-white" />
      </div>
      <div className="relative space-y-3">
        {richText && (
          <RichText
            className="prose-headings:text-white text-white"
            data={richText}
            enableGutter={false}
          />
        )}
        <div className="relative flex flex-row gap-3">
          {(links || []).map(({ link }, i) => {
            return (
              <CMSLink
                key={i}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-black text-white no-underline [a]:hover:bg-black/80",
                )}
                link={link}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
