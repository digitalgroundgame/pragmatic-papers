import React from "react"

import type { MerchBlock as MerchBlockProps } from "@/payload-types"

import type { BlockConverters } from "@/components/RichText"
import type { SerializedBlockNode } from "@payloadcms/richtext-lexical"
import { MerchBlock } from "./Component"

/**
 * The Merch block's Lexical converter, kept out of `RichText` itself.
 *
 * `RichText` is reachable from client components (the Form block renders its
 * field rich text in the browser), and this block queries Payload — importing
 * it there would pull the Payload config, and with it `sharp`, into the browser
 * bundle, where its native dependencies don't resolve.
 *
 * Server callers that allow inline merch — today `ContentBlock`, the only
 * editor where the block is offered — pass this to `RichText`.
 */
export const merchBlockConverters: BlockConverters = {
  merch: ({ node }: { node: SerializedBlockNode<MerchBlockProps> }) => (
    <MerchBlock {...node.fields} enableGutter={false} />
  ),
}
