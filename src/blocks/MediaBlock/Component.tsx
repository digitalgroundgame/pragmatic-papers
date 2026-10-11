import type { MediaBlock as MediaBlockProps, Media as MediaType } from "@/payload-types"
import {
  type JSXConvertersFunction,
  LinkJSXConverter,
  RichText,
} from "@payloadcms/richtext-lexical/react"
import React from "react"

import { Media } from "@/components/Media"
import { isMedia } from "@/components/Media"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { type ImageVariant } from "@/components/Media/CMSImage"
import { internalDocToHref } from "@/components/RichText/internalDocToHref"
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
      <HoverPrefetchLink
        className="underline underline-offset-2"
        href={href}
        rel={rel}
        target={target}
      >
        {children}
      </HoverPrefetchLink>
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

type MediaBlockFrameProps = Pick<
  StyledMediaBlockProps,
  "breakout" | "className" | "enableGutter"
> & {
  /** `picture` may only hold `<source>` and `<img>`; wrap anything else in a `figure`. */
  as?: "figure" | "picture"
  children: React.ReactNode
}

export const MediaBlockFrame: React.FC<MediaBlockFrameProps> = ({
  as: Slot = "figure",
  breakout,
  children,
  className,
  enableGutter = true,
}) => {
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
      {children}
    </Slot>
  )
}

type MediaBlockImageProps = Pick<
  StyledMediaBlockProps,
  "imgClassName" | "imgStyle" | "sizes" | "variant"
> & {
  media: MediaType
}

export const MediaBlockImage: React.FC<MediaBlockImageProps> = ({
  imgClassName,
  imgStyle,
  media,
  sizes,
  variant = "medium",
}) => (
  <Media
    className={cn("mx-auto border", imgClassName)}
    style={imgStyle}
    media={media}
    sizes={sizes || "(max-width: 768px) 100vw, 800px"}
    variant={variant}
  />
)

type MediaBlockCaptionProps = Pick<
  StyledMediaBlockProps,
  "captionClassName" | "disableInnerContainer"
> & {
  caption: MediaType["caption"]
}

export const MediaBlockCaption: React.FC<MediaBlockCaptionProps> = ({
  caption,
  captionClassName,
  disableInnerContainer,
}) => {
  if (!caption) return null

  return (
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
  )
}

export const MediaBlock: React.FC<StyledMediaBlockProps> = ({
  breakout,
  captionClassName,
  className,
  disableInnerContainer,
  enableGutter,
  imgClassName,
  imgStyle,
  media,
  sizes,
  variant,
}) => {
  if (!isMedia(media)) return null

  const { caption } = media

  return (
    <MediaBlockFrame
      as={caption ? "figure" : "picture"}
      breakout={breakout}
      className={className}
      enableGutter={enableGutter}
    >
      <MediaBlockImage
        media={media}
        imgClassName={imgClassName}
        imgStyle={imgStyle}
        sizes={sizes}
        variant={variant}
      />
      <MediaBlockCaption
        caption={caption}
        captionClassName={captionClassName}
        disableInnerContainer={disableInnerContainer}
      />
    </MediaBlockFrame>
  )
}
