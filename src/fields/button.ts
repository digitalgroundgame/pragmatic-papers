import { colorPicker } from "@/fields/colorPicker"
import { link } from "@/fields/link2"
import type { NamedGroupField } from "payload"

type ButtonProps = Omit<NamedGroupField, "fields" | "name" | "type" | "interfaceName">

/**
 * Utility function for constructing a Payload CMS button group field.
 * Provides a standard button configuration with color pickers and variant select.
 *
 * @param props - Any NamedGroupField properties except 'fields', 'name', 'type', and 'interfaceName'.
 * @returns NamedGroupField config for use in a collection or global.
 *
 * Example usage:
 *   fields: [
 *     button({
 *       label: 'Call to Action',
 *       admin: { condition: () => true },
 *     })
 *   ]
 */
export const button = (props?: ButtonProps): NamedGroupField => {
  return {
    /**
     * Sets the admin label for this button field.
     */
    label: "Button",
    ...props,
    /**
     * The machine name for this field (do not change unless required).
     */
    name: "button",
    /**
     * Interface name to aid with Payload codegen/types.
     */
    interfaceName: "ButtonField",
    type: "group",
    fields: [
      /**
       * The button's link (label, href, etc).
       */
      link(),
      {
        type: "row",
        fields: [
          /**
           * Background color picker for button.
           */
          colorPicker({ name: "backgroundColor", label: "Background Color" }),
          /**
           * Text color picker for button.
           */
          colorPicker({ name: "textColor", label: "Text Color" }),
          /**
           * Button style variant select.
           */
          {
            type: "select",
            name: "variant",
            label: "Variant",
            options: ["default", "outline", "ghost", "link"],
            defaultValue: "default",
          },
        ],
      },
    ],
  }
}
