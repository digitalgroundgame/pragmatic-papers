import { link, type LinkFieldOverrides } from "@/fields/link"
import type { ArrayField, Field } from "payload"

/**
 * Utility function for constructing a Payload CMS menu field
 * as an array of link fields. Includes sensible defaults for
 * admin UI and typing, but accepts overrides.
 *
 * @param link - Overrides for each item's link field (e.g. a different default variant).
 * @param props - Any ArrayField properties except 'type' and 'fields'.
 * @returns Field config for use in a collection or global.
 *
 * Example usage:
 *   fields: [
 *     menu({
 *       name: 'mainMenu',
 *       label: 'Main Navigation',
 *       labels: { singular: 'Menu Item', plural: 'Menu Items' },
 *     })
 *   ]
 */
export const menu = ({
  link: linkOverrides,
  ...props
}: Omit<ArrayField, "type" | "fields"> & { link?: LinkFieldOverrides }): Field => {
  return {
    label: "Menu",
    ...props,
    type: "array",
    fields: [link(linkOverrides)],
    interfaceName: "MenuField",
    admin: {
      initCollapsed: true, // collapse by default for UI clarity
      components: {
        RowLabel: "@/fields/menu/RowLabel#RowLabel", // sets a custom row label for display
        ...props.admin?.components,
      },
      ...props.admin,
    },
  }
}
