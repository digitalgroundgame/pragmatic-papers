import { type FormBlock as FormBlockType } from "@/payload-types"
import React from "react"

import RichText from "@/components/RichText"
import { FormBlockClient } from "./FormBlockClient"

/**
 * The form's rich text is rendered here, on the server, and handed to the
 * client component as elements.
 *
 * Rendering it inside `FormBlockClient` would pull `RichText` — and with it
 * every block in the Lexical converter — into the browser bundle. Blocks that
 * query Payload (Merch, and anything like it later) would drag the Payload
 * config along with them, which doesn't resolve in a browser build.
 */
export const FormBlock: React.FC<FormBlockType> = ({ form, ...block }) => {
  if (typeof form === "number") return null

  const intro =
    block.enableIntro && block.introContent ? (
      <RichText className="mb-8 lg:mb-12" data={block.introContent} enableGutter={false} />
    ) : null

  const confirmation =
    form.confirmationType === "message" && form.confirmationMessage ? (
      <RichText data={form.confirmationMessage} />
    ) : null

  return <FormBlockClient form={form} intro={intro} confirmation={confirmation} />
}
