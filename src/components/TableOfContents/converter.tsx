import { Link } from "lucide-react"
import type { ComponentType, SVGProps } from "react"

import type { SerializedHeadingNode } from "@payloadcms/richtext-lexical"
import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"
import type { JSXConverter, JSXConverterArgs } from "@payloadcms/richtext-lexical/react"

import { AnchoredHeading } from "./AnchoredHeading"
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
      if (!id) return <Tag>{children}</Tag>
      return (
        <AnchoredHeading tag={Tag} id={id} icon={<Icon aria-hidden="true" className="size-4" />}>
          {children}
        </AnchoredHeading>
      )
    },
  }
}

/** Blocks render their own markup, so the stamped anchor goes on a wrapper. */
export function withTableOfContentsAnchors<T extends Record<string, JSXConverter<never>>>(
  converters: T,
): T {
  return Object.fromEntries(
    Object.entries(converters).map(([blockType, convert]) => [
      blockType,
      (args: JSXConverterArgs<AnchoredNode>) => {
        const rendered = typeof convert === "function" ? convert(args as never) : convert
        const id = args.node.anchor
        return id ? <div id={id}>{rendered}</div> : rendered
      },
    ]),
  ) as unknown as T
}
