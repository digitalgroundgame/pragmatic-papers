import { type FormBlock as FormBlockType } from "@/payload-types"
import React from "react"

import RichText from "@/components/RichText"
import { FormBlockClient } from "./FormBlockClient"
import { Message } from "./Message"

/**
 * Every piece of the form's rich text is rendered here, on the server, and
 * handed to the client component as elements: the intro, the confirmation
 * message, and any `message` fields sitting between the inputs.
 *
 * `RichText` is server-only — it renders blocks that query Payload — so the
 * client component must never import it. Message fields have no interactive
 * behaviour, so pre-rendering them costs nothing.
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

  // Keyed by position so the client component can slot each one back into the
  // same place in the field order.
  const messages: Record<number, React.ReactNode> = {}
  form.fields?.forEach((field, index) => {
    if (field.blockType === "message" && field.message) {
      messages[index] = <Message message={field.message} />
    }
  })

  return (
    <FormBlockClient form={form} intro={intro} confirmation={confirmation} messages={messages} />
  )
}
