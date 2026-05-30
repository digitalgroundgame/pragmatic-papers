import { type Block } from "payload"

export const InlineMathBlock: Block = {
  slug: "inlineMathBlock",
  interfaceName: "InlineMathBlock",
  fields: [
    {
      name: "math",
      type: "text",
      required: true,
      label: "Math Expression",
      admin: {
        description: "Enter a LaTeX math expression.",
      },
    },
  ],
  graphQL: {
    singularName: "InlineMathBlock",
  },
  labels: {
    plural: "Inline Math Blocks",
    singular: "Inline Math Block",
  },
  admin: {
    components: {
      Label: "/blocks/Math/AdminComponent",
    },
  },
}

export const DisplayMathBlock: Block = {
  slug: "displayMathBlock",
  interfaceName: "DisplayMathBlock",
  fields: [
    {
      name: "math",
      type: "textarea",
      required: true,
      label: "Math Expression",
      admin: {
        description: "Enter a LaTeX math expression.",
      },
    },
  ],
  graphQL: {
    singularName: "DisplayMathBlock",
  },
  labels: {
    plural: "Display Math Blocks",
    singular: "Display Math Block",
  },
  admin: {
    components: {
      Label: "/blocks/Math/AdminComponent",
    },
  },
}
