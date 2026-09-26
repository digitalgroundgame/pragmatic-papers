import { Link } from "lucide-react"
import type { ComponentType, SVGProps } from "react"

import type { SerializedHeadingNode } from "@payloadcms/richtext-lexical"
import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"
import type { JSXConverter, JSXConverterArgs } from "@payloadcms/richtext-lexical/react"

import type { AnchoredNode } from "./types"

export type HeadingJSXConverter = JSXConverter<SerializedHeadingNode>

export interface CreateTableOfContentsConverter {
  heading: HeadingJSXConverter
  table: JSXConverter<SerializedLexicalNode>
}

export function createTableOfContentsConverter(
  Icon: ComponentType<SVGProps<SVGSVGElement>> = Link,
): CreateTableOfContentsConverter {
  return {
    table: ({ node, nodesToJSX }) => {
      const id = (node as AnchoredNode).anchor
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
      const id = (node as AnchoredNode<SerializedHeadingNode>).anchor
      const children = nodesToJSX({ nodes: node.children })
      return (
        <Tag id={id} className="group">
          {id ? (
            <a
              href={`#${id}`}
              aria-label="Link to section"
              className="group inline-flex items-baseline gap-1 text-inherit no-underline"
            >
              {children}
              <Icon
                aria-hidden="true"
                className="text-muted-foreground size-4 opacity-0 group-hover:opacity-100"
              />
            </a>
          ) : (
            children
          )}
        </Tag>
      )
    },
  }
}
