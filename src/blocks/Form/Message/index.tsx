import RichText from "@/components/RichText"
import React from "react"

import { Width } from "../Width"
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical"
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"

export const Message: React.FC<{ message: SerializedEditorState }> = ({ message }) => {
  return (
    <Width className="my-12" width="100">
      {message && <RichText data={message as unknown as DefaultTypedEditorState} />}
    </Width>
  )
}
