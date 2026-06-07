import type { DefaultTypedEditorState, SerializedHeadingNode } from "@payloadcms/richtext-lexical"
import type { JSXConverter, JSXConverterArgs } from "@payloadcms/richtext-lexical/react"
import { Link } from "lucide-react"
import type { ComponentType, SVGProps } from "react"

import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"

import { slugifyHeading } from "./slug"
import { computeAnchors, headingAnchorGenerator, tableAnchorGenerator } from "./traverse"
import type { SlugifyFn } from "./types"

export type HeadingJSXConverter = JSXConverter<SerializedHeadingNode>

export interface CreateTableOfContentsConverter {
  heading: HeadingJSXConverter
  table: JSXConverter<SerializedLexicalNode>
}

export function createTableOfContentsConverter(
  data?: DefaultTypedEditorState,
  slugify: SlugifyFn = slugifyHeading,
  Icon: ComponentType<SVGProps<SVGSVGElement>> = Link,
): CreateTableOfContentsConverter {
  const anchors = computeAnchors(data, {
    heading: headingAnchorGenerator(slugify),
    table: tableAnchorGenerator,
  })
  return {
    table: ({ node, nodesToJSX }) => {
      const id = anchors.get(node)
      const children = nodesToJSX({
        nodes:
          (node as SerializedLexicalNode & { children?: SerializedLexicalNode[] }).children ?? [],
      })
      return (
        <div id={id} className="lexical-table-container">
          <table className="lexical-table" style={{ borderCollapse: "collapse" }}>
            <tbody>{children}</tbody>
          </table>
        </div>
      )
    },
    heading: ({ node, nodesToJSX }: JSXConverterArgs<SerializedHeadingNode>) => {
      const Tag = node.tag as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
      const id = anchors.get(node)
      const children = nodesToJSX({ nodes: node.children })
      return (
        <Tag id={id} className="group">
          {id && (
            <a
              href={`#${id}`}
              aria-label="Link to section"
              className="group inline-flex items-baseline gap-1 no-underline"
            >
              {children}
              <Icon
                aria-hidden="true"
                className="text-muted-foreground size-4 opacity-0 group-hover:opacity-100"
              />
            </a>
          )}
        </Tag>
      )
    },
  }
}
