import type { MediaBlock as MediaBlockProps } from "@/payload-types"
import {
  type JSXConvertersFunction,
  LinkJSXConverter,
  RichText,
} from "@payloadcms/richtext-lexical/react"
import React from "react"

import { Media } from "@/components/Media"
import { type ImageVariant } from "@/components/Media/ImageMedia"
import { internalDocToHref } from "@/components/RichText"
import { cn } from "@/utilities/utils"
import { type DefaultNodeTypes } from "@payloadcms/richtext-lexical"

export type StyledMediaBlockProps = Omit<MediaBlockProps, "blockType"> & {
  breakout?: boolean
  className?: string
  imgClassName?: string
  imgStyle?: React.CSSProperties
  captionClassName?: string
  enableGutter?: boolean
  sizes?: string | undefined
  disableInnerContainer?: boolean
  variant?: ImageVariant
}

const converters: JSXConvertersFunction<DefaultNodeTypes> = ({ defaultConverters }) => ({
  ...defaultConverters,
  ...LinkJSXConverter({ internalDocToHref }),
  link: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({ nodes: node.children })
    const rel = node.fields.newTab ? "noopener noreferrer" : undefined
    const target = node.fields.newTab ? "_blank" : undefined
    const href =
      node.fields.linkType === "internal"
        ? internalDocToHref({ linkNode: node })
        : (node.fields.url ?? "")
    return (
      <a className="underline underline-offset-2" href={href} rel={rel} target={target}>
        {children}
      </a>
    )
  },
  autolink: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({ nodes: node.children })
    const rel = node.fields.newTab ? "noopener noreferrer" : undefined
    const target = node.fields.newTab ? "_blank" : undefined
    return (
      <a className="underline underline-offset-2" href={node.fields.url} rel={rel} target={target}>
        {children}
      </a>
    )
  },
  paragraph: ({ node, nodesToJSX }) => (
    <React.Fragment>{nodesToJSX({ nodes: node.children })}</React.Fragment>
  ),
})

export const MediaBlock: React.FC<StyledMediaBlockProps> = ({ sizes, ...props }) => {
  const {
    breakout,
    captionClassName,
    className,
    enableGutter = true,
    imgClassName,
    imgStyle,
    media,
    variant = "medium",
    disableInnerContainer,
  } = props
  if (typeof media === "number" || !media) return null

  sizes = sizes || "(max-width: 768px) 100vw, 800px"

  const { caption } = media

  const Slot: React.ElementType = caption ? "figure" : "picture"
  return (
    <Slot
      className={cn(
        {
          container: enableGutter,
          "lg:-mx-8 xl:-mx-16": breakout,
        },
        className,
      )}
    >
      <Media
        className={cn("border", imgClassName)}
        style={imgStyle}
        media={media}
        sizes={sizes}
        variant={variant}
      />
      {caption && (
        <figcaption
          className={cn(
            "my-1.5 text-start font-serif leading-tight",
            {
              container: !disableInnerContainer,
            },
            captionClassName,
          )}
        >
          <RichText converters={converters} data={caption} disableContainer />
        </figcaption>
      )}
    </Slot>
  )
}
