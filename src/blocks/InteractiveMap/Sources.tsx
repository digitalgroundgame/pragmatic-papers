import React from "react"

import type { InteractiveMapBlock as InteractiveMapBlockProps } from "@/payload-types"

import { CMSLink } from "@/components/Link/CMSLink2"
import { Logo } from "@/components/Logo"
import { cn } from "@/utilities/utils"
import { Info, type Data } from "./Info"

type SourcesProps = Pick<InteractiveMapBlockProps, "colorBias" | "sources"> & {
  /** Extra lines for the info popup, from whichever map this footer is under. */
  notes?: readonly Data[]
  className?: string
}

export function Sources({ sources, colorBias, notes, className }: SourcesProps): React.ReactNode {
  const data: Data[] = []
  if (colorBias != null) data.push({ label: "Bias", value: colorBias })
  if (notes) data.push(...notes)

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      {sources && sources.length > 0 && (
        <p className="text-muted-foreground mr-auto text-xs">
          Source{sources.length > 1 ? "s" : ""}:{" "}
          {sources.map(({ id, link }, i) => (
            <React.Fragment key={id || i}>
              <CMSLink link={link} className="hover:text-foreground underline" />
              {i < sources.length - 1 ? ", " : ""}
            </React.Fragment>
          ))}
        </p>
      )}
      <Info className="ml-auto" data={data} />
      <Logo size="xs" />
    </div>
  )
}
