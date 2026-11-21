import type { Field } from "payload"

import { LAST_COMMENTED_FIELD } from "../constants"

/** The authors' field: hidden, and written only by the plugin when a comment is posted. */
export const lastCommentedField = (): Field => ({
  name: LAST_COMMENTED_FIELD,
  type: "date",
  access: { create: () => false, update: () => false },
  admin: { hidden: true },
})
