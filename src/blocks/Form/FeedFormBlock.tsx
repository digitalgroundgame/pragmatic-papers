import type { FeedBlockRenderer } from "@/app/feed/blocks/types"
import type { FormBlock as FormBlockType } from "@/payload-types"
import { isResolved } from "@/utilities/relationships"
import React from "react"
import { FormBlock } from "./Component"
import { FeedFormButton } from "./FeedFormButton"

// Renders the form on the server, as the article page does, so its intro,
// confirmation and message fields keep their rich text; the client button
// only owns the dialog.
export const FeedFormBlock: FeedBlockRenderer = ({ node }) => {
  const fields = node.fields as FormBlockType | undefined
  if (!fields || !isResolved(fields.form)) return null

  const triggerLabel = fields.form.title || fields.form.submitButtonLabel || "Open form"

  return (
    <FeedFormButton triggerLabel={triggerLabel}>
      <FormBlock {...fields} />
    </FeedFormButton>
  )
}
