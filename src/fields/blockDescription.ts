import type { Field } from "payload"

export const blockDescriptionField = (): Field => ({
  name: "description",
  type: "text",
  label: "Description",
  admin: {
    placeholder:
      "Text spoken by AI voice-over (ElevenLabs) and used for screen reader accessibility (aria-label/alt).",
  },
})
