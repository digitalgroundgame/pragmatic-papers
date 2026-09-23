"use client"

import { InfoIcon } from "lucide-react"
import React from "react"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/utilities/utils"

export interface Data {
  label: string
  value: React.ReactNode
}

interface InfoProps {
  data: Data[]
  className?: string
}

export function Info({ data, className }: InfoProps): React.ReactNode {
  if (data.length === 0) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          aria-label="Map information"
          className={cn(
            "text-muted-foreground hover:text-foreground flex cursor-default items-center",
            className,
          )}
        >
          <InfoIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          <dl className="space-y-0.5">
            {data.map(({ label, value }) => (
              <div key={label} className="flex gap-2">
                <dt className="opacity-70">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
