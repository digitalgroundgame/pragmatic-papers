import type { DefaultTypedEditorState, SerializedHeadingNode } from "@payloadcms/richtext-lexical"
import type { JSXConverter, JSXConverterArgs } from "@payloadcms/richtext-lexical/react"

import { slugifyHeading } from "./slug"
import { computeHeadingAnchors } from "./traverse"
import type { SlugifyFn } from "./types"

export type HeadingJSXConverter = JSXConverter<SerializedHeadingNode>

export function createHeadingConverter(
  data: DefaultTypedEditorState,
  slugify: SlugifyFn = slugifyHeading,
): { heading: HeadingJSXConverter } {
  const anchors = computeHeadingAnchors(data, slugify)
  return {
    heading: ({ node, nodesToJSX }: JSXConverterArgs<SerializedHeadingNode>) => {
      const Tag = node.tag as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
      const id = anchors.get(node)
      const children = nodesToJSX({ nodes: node.children })
      return <Tag id={id}>{children}</Tag>
    },
  }
}
