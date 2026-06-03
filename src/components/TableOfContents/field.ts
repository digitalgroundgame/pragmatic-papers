import type { Field } from "payload"

export const tableOfContentsField: Field = {
  name: "showTableOfContents",
  type: "checkbox",
  label: "Show table of contents",
  defaultValue: false,
  admin: {
    description:
      "Auto-generates a navigable list of headings (and any resolver-matched blocks) at the top of the article.",
  },
}
