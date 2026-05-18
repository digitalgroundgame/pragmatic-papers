import type { Form } from "@/payload-types"
import type { Payload } from "payload"

import { createRichTextContent } from "./richtext"

export async function createContactForm(payload: Payload, title = "Contact Form"): Promise<Form> {
  return await payload.create({
    collection: "forms",
    data: {
      title,
      fields: [
        {
          blockType: "text",
          name: "name",
          label: "Name",
          required: true,
          width: 100,
        },
        {
          blockType: "email",
          name: "email",
          label: "Email",
          required: true,
          width: 100,
        },
        {
          blockType: "text",
          name: "subject",
          label: "Subject",
          required: true,
          width: 100,
        },
        {
          blockType: "textarea",
          name: "message",
          label: "Message",
          required: true,
          width: 100,
        },
      ],
      submitButtonLabel: "Send Message",
      confirmationType: "message",
      confirmationMessage: createRichTextContent(
        "Thank you for reaching out! We will get back to you as soon as possible.",
      ),
    },
  })
}
