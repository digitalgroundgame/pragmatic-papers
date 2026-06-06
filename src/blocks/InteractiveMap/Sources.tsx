import React from "react"

import type { InteractiveMapBlock as InteractiveMapBlockProps } from "@/payload-types"

import { CMSLink } from "@/components/Link/CMSLink2"
import { Logo } from "@/components/Logo"

interface SourcesProps {
  sources: InteractiveMapBlockProps["sources"]
}

export function Sources({ sources }: SourcesProps): React.ReactNode {
  return (
    <div className="flex items-center gap-2">
      {sources && sources.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Source{sources.length > 1 ? "s" : ""}:{" "}
          {sources.map(({ id, link }, i) => (
            <React.Fragment key={id || i}>
              <CMSLink link={link} className="underline" />
              {i < sources.length - 1 ? ", " : ""}
            </React.Fragment>
          ))}
        </p>
      )}
      <Logo className="ml-auto" size="xs" />
    </div>
  )
}
