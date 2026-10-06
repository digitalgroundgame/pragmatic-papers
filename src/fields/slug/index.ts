import {
  slugField as payloadSlugField,
  type FieldHook,
  type RowField,
  type TextField,
} from "payload"
import { slugify as defaultSlugify } from "payload/shared"

type SlugFieldArgs = NonNullable<Parameters<typeof payloadSlugField>[0]>

/**
 * Payload's `slugField`, with the slug generated on create by the `slug` field
 * itself.
 *
 * Payload generates the slug in a `beforeChange` hook on the hidden
 * `generateSlug` checkbox. Since 3.90.2 (payloadcms/payload#18181) that hook
 * awaits `slugify` before assigning `data.slug`, and sibling fields run their
 * `beforeChange` step concurrently, so the required `slug` validates before
 * the value arrives: every create without a slug fails with "Slug: This field
 * is required" (payloadcms/payload#18334).
 *
 * A field validates only after its own `beforeChange` hooks resolve, so
 * generating the slug in a hook on `slug` makes it present in time on any
 * Payload version. It can't move earlier to `beforeValidate`: defaults resolve
 * concurrently in that pass, and the Volumes slug comes from `volumeNumber`'s
 * async default. Payload's hook computes the same value, so the checkbox and
 * update behavior stay Payload's.
 */
export const slugField = (args: SlugFieldArgs = {}): RowField => {
  const { fieldToUse, name = "slug", overrides, slugify, useAsSlug = "title" } = args
  const sourceField = fieldToUse || useAsSlug

  const generateOnCreate: FieldHook = async ({ data, operation, req, value }) => {
    if (operation !== "create" || value || !data?.[sourceField]) return value

    const valueToSlugify = data[sourceField]
    return slugify ? slugify({ data, req, valueToSlugify }) : defaultSlugify(valueToSlugify)
  }

  return payloadSlugField({
    ...args,
    overrides: (row) => {
      const slug = row.fields.find(
        (field): field is TextField => "name" in field && field.name === name,
      )
      if (slug) {
        slug.hooks = {
          ...slug.hooks,
          beforeChange: [generateOnCreate, ...(slug.hooks?.beforeChange ?? [])],
        }
      }
      return overrides ? overrides(row) : row
    },
  })
}
