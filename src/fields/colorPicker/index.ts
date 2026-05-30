import type { TextField, TextFieldSingleValidation } from "payload"

const validateColorPicker: TextFieldSingleValidation = (value, options) => {
  if (!value && !options?.required) return true // Allow empty values if not required

  // Validate HEX color format
  const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  if (hexColorRegex.test(value || "")) {
    return true
  }

  return "Please enter a valid HEX color code (e.g., #FF5733 or #F53)"
}

type ColorPickerProps = Omit<TextField, "type">

/**
 * `colorPicker` is a utility function to create a custom Payload CMS text field
 * configured to be used as a HEX color picker. It provides custom validation
 * for HEX colors and wires up a custom React color picker field component.
 *
 * @param props - Standard Payload TextField props (except `type`)
 * @returns A configured TextField object suitable for use in Payload collections.
 *
 * @example
 * ```ts
 * // Example usage in a Payload field definition:
 * fields: [
 *   colorPicker({
 *     name: 'brandColor',
 *     label: 'Brand Color',
 *     required: true,
 *     admin: { ... },
 *   })
 * ]
 * ```
 */
export const colorPicker = (props: ColorPickerProps): TextField => {
  return {
    label: "Color Picker",
    ...props,
    type: "text",
    admin: {
      description: "Select a color using the color picker or enter a HEX code (e.g., #FF5733)",
      components: {
        Field: {
          path: "@/fields/colorPicker/ColorPickerComponent#ColorPickerComponent",
        },
        ...props.admin?.components,
      },
      ...props.admin,
    },
    hasMany: false,
    maxRows: undefined,
    minRows: undefined,
    validate: validateColorPicker,
  }
}
