import type {
  ArrayField,
  CheckboxField,
  FieldHook,
  GroupField,
  NumberField,
  TextareaField,
} from "payload"
import { link, type LinkFieldOverrides } from "./link2"

const prependHttpsHook: FieldHook = ({ siblingData, value }) => {
  if (siblingData?.type !== "custom") {
    return value
  }

  if (typeof value !== "string") {
    return value
  }

  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return value
  }

  if (trimmedValue.toLowerCase().startsWith("http")) {
    return trimmedValue
  }

  return `https://${trimmedValue}`
}

interface FootnoteFieldOverrides {
  component?: {
    note?: Partial<TextareaField>
    attributionEnabled?: Partial<CheckboxField>
    link?: LinkFieldOverrides
  }
}

export const footnoteFields = ({ component = {} }: FootnoteFieldOverrides = {}): [
  TextareaField,
  NumberField,
  CheckboxField,
  GroupField,
] => {
  const { note = {}, attributionEnabled = {}, link: linkComponent = {} } = component
  return [
    {
      name: "note",
      type: "textarea",
      required: true,
      admin: {
        description: "Footnote text.",
        placeholder: "Enter footnote text here...",
        rows: 3,
        ...note.admin,
      },
    },
    {
      name: "index",
      type: "number",
      admin: {
        hidden: true,
        description: "Auto-generated on save.",
        readOnly: true,
      },
    },
    {
      name: "attributionEnabled",
      label: "Enable Attribution",
      type: "checkbox",
      defaultValue: false,
      required: true,
      admin: {
        description: "Optionally add a source link to the footnote.",
        ...attributionEnabled.admin,
      },
    },
    link({
      label: "Attribution Link",
      admin: {
        condition:
          linkComponent.admin?.condition ??
          ((_, siblingData) => Boolean(siblingData?.attributionEnabled)),
      },
      required: true,
      component: {
        type: {
          defaultValue: "custom",
        },
        newTab: {
          defaultValue: true,
        },
        url: {
          hooks: {
            beforeValidate: [prependHttpsHook],
          },
        },
        label: {
          admin: {
            hidden: true,
          },
        },
      },
    }),
  ]
}

export const footnotesArrayField = (): ArrayField => ({
  name: "footnotes",
  interfaceName: "FootnotesField",
  type: "array",
  fields: footnoteFields(),
  access: {
    update: () => false,
  },
  admin: {
    condition: (data) => Boolean(data?.footnotes?.length),
    components: {
      Field: "@/blocks/Footnote/FootnotesPreview#FootnotesPreview",
    },
  },
})
