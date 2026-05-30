import React from "react"

import type { Page } from "@/payload-types"

import RichText from "@/components/RichText"
import { Separator } from "@/components/ui/separator"

type PageHeroType =
  | {
      children?: React.ReactNode
      richText?: never
    }
  | (Omit<Page["hero"], "richText"> & {
      children?: never
      richText?: Page["hero"]["richText"]
    })

export const PageHero: React.FC<PageHeroType> = ({ children, richText }) => {
  return (
    <div className="container max-w-3xl">
      {children || (richText && <RichText data={richText} enableGutter={false} />)}
      <Separator className="my-6" />
    </div>
  )
}
