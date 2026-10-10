import type { CheckboxField } from "payload"

export type TableOfContentsFieldOptions = Omit<CheckboxField, "name" | "type">
export type TableOfContentsField = (options?: TableOfContentsFieldOptions) => CheckboxField

export const tableOfContentsField: TableOfContentsField = (options) => ({
  label: "Show table of contents",
  defaultValue: false,
  ...options,
  admin: {
    position: "sidebar",
    description:
      "Auto-generates a navigable list of headings (and any resolver-matched blocks). Readers see it only while the table of contents experiment is on in Settings.",
    ...options?.admin,
    components: {
      Field: "@/components/TableOfContents/admin#TableOfContentsCheckbox",
      ...options?.admin?.components,
    },
  },
  name: "showTableOfContents",
  type: "checkbox",
})
