import type { CheckboxField } from "payload"

export type TableOfContentsFieldOptions = Omit<CheckboxField, "name" | "type">
export type TableOfContentsField = (options?: TableOfContentsFieldOptions) => CheckboxField

export const tableOfContentsField: TableOfContentsField = (options) => ({
  label: "Show table of contents",
  defaultValue: false,
  ...options,
  admin: {
    position: "sidebar",
    description: "Auto-generates a navigable list of headings (and any resolver-matched blocks).",
    ...options?.admin,
  },
  name: "showTableOfContents",
  type: "checkbox",
})
