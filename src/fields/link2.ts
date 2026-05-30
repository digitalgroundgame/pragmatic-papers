import type {
  CheckboxField,
  GroupField,
  NamedGroupField,
  RadioField,
  SelectField,
  SingleRelationshipField,
  TextField,
  TextFieldSingleValidation,
} from "payload"

interface LinkFields {
  label?: Partial<TextField>
  newTab?: Partial<CheckboxField>
  reference?: Partial<SingleRelationshipField>
  type?: Partial<RadioField>
  url?: Partial<TextField>
  variant?: Omit<Partial<SelectField>, "type" | "hasMany" | "validate">
}

export type LinkFieldOverrides = Omit<
  NamedGroupField,
  "fields" | "name" | "type" | "interfaceName"
> & {
  component?: LinkFields
  name?: string
}

/**
 * New Link Field with component overrides
 * @param component - The component overrides
 * @param props - The props for the base link field
 * @returns The link field
 */
export const link = ({
  component = {},
  name = "link",
  ...props
}: LinkFieldOverrides = {}): GroupField => {
  const { type = {}, newTab = {}, reference = {}, url = {}, label = {}, variant = {} } = component
  return {
    label: "Link",
    ...props,
    name,
    type: "group",
    interfaceName: "LinkField",
    fields: [
      {
        type: "row",
        fields: [
          {
            label: "Type",
            name: "type",
            type: "radio",
            defaultValue: type.defaultValue || "reference",
            options: [
              {
                label: "Internal link",
                value: "reference",
              },
              {
                label: "Custom URL",
                value: "custom",
              },
            ],
            admin: {
              layout: "horizontal",
              style: {
                flex: 1,
                ...type.admin?.style,
              },
              ...type.admin,
            },
          },
          {
            ...newTab,
            name: "newTab",
            type: "checkbox",
            label: "Open in new tab",
            admin: {
              ...newTab.admin,
              style: {
                alignSelf: "center",
                marginTop: "12px",
                ...newTab.admin?.style,
              },
            },
          },
          {
            label: "Appearance",
            name: "variant",
            type: "select",
            defaultValue: "link",
            options: [
              { label: "Link", value: "link" },
              { label: "Default", value: "default" },
              { label: "Outline", value: "outline" },
              { label: "Ghost", value: "ghost" },
              { label: "Branded", value: "branded" },
            ],
            ...variant,
          },
        ],
      },
      {
        type: "row",
        fields: [
          {
            label: reference.label || "Document to link to",
            relationTo: ["pages", "volumes", "articles", "topics"],
            name: "reference",
            type: "relationship",
            required: true,
            admin: {
              condition: (_, siblingData) => siblingData?.type === "reference",
            },
          },
          {
            label: url.label || "Custom URL",
            name: "url",
            type: "text",
            required: true,
            hooks: { ...url.hooks },
            admin: {
              condition: (_, siblingData) => siblingData?.type === "custom",
              ...url.admin,
            },
          },
          {
            label: label.label || "Label",
            admin: {
              ...label.admin,
            },
            hooks: { ...label.hooks },
            hasMany: false,
            validate: label.validate as TextFieldSingleValidation,
            name: "label",
            type: "text",
            required: false,
          },
        ],
      },
    ],
  }
}
