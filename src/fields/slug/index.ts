import {
  slugField as payloadSlugField,
  type FieldHook,
  type RowField,
  type TextField,
} from "payload"
import { slugify as defaultSlugify } from "payload/shared"

type SlugFieldArgs = NonNullable<Parameters<typeof payloadSlugField>[0]>

/**
 * Runs Payload's checkbox hook, then, on update, puts back the slug it
 * replaced: the one the save brought, or the document's when the save brought
 * none. A slug the save cleared stays empty, so the `slug` field's hook
 * regenerates it. Payload assigns a synchronous `slugify`'s result before its
 * hook first yields, so the first restore lands before the `slug` field reads
 * it; the second covers an async `slugify`, which assigns after.
 */
export function keepSlugOnUpdate(hook: FieldHook, name: string): FieldHook {
  return (args) => {
    const { data, operation } = args
    const given = data?.[name]
    const slug = given === undefined ? args.originalDoc?.[name] : given
    const restore = () => {
      if (operation === "update" && data && slug) data[name] = slug
    }
    const result = hook(args)
    restore()
    return Promise.resolve(result).then((value) => {
      restore()
      return value
    })
  }
}

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
 * async default.
 *
 * The same race loses the slug on update: Payload's hook assigns it after the
 * `slug` field has already been written, so a draft whose first save had no
 * title kept an empty slug through every later autosave, and with it no
 * Preview button. So while the checkbox is ticked, the hook here also fills an
 * empty slug on update. It never replaces one: a published article can still
 * have the checkbox ticked, and a new slug would move it to a new URL.
 *
 * Payload 3.94 (payloadcms/payload#18682) assigns a synchronous `slugify`'s
 * result before yielding, so its hook now lands in time, and on update it
 * re-slugs from the title whenever the checkbox is ticked. `keepSlugOnUpdate`
 * wraps that hook so an update keeps the slug the save brought (or the one the
 * document has), and only an empty slug is filled.
 */
export const slugField = (args: SlugFieldArgs = {}): RowField => {
  const {
    checkboxName = "generateSlug",
    fieldToUse,
    name = "slug",
    overrides,
    slugify,
    useAsSlug = "title",
  } = args
  const sourceField = fieldToUse || useAsSlug

  const generate: FieldHook = async ({ data, operation, originalDoc, req, siblingData, value }) => {
    if (value || !data?.[sourceField]) return value
    if (operation === "update") {
      // Read before Payload's hook on the checkbox replaces it with its verdict for this save.
      const checked = siblingData?.[checkboxName] ?? originalDoc?.[checkboxName]
      if (!checked) return value
    } else if (operation !== "create") {
      return value
    }

    const valueToSlugify = data[sourceField]
    return slugify ? slugify({ data, req, valueToSlugify }) : defaultSlugify(valueToSlugify)
  }

  return payloadSlugField({
    ...args,
    overrides: (row) => {
      const slug = row.fields.find(
        (field): field is TextField => "name" in field && field.name === name,
      )
      const checkbox = row.fields.find((field) => "name" in field && field.name === checkboxName)
      if (checkbox && "hooks" in checkbox && checkbox.hooks?.beforeChange) {
        checkbox.hooks.beforeChange = checkbox.hooks.beforeChange.map((hook) =>
          keepSlugOnUpdate(hook, name),
        )
      }
      if (slug) {
        slug.hooks = {
          ...slug.hooks,
          beforeChange: [generate, ...(slug.hooks?.beforeChange ?? [])],
        }
      }
      return overrides ? overrides(row) : row
    },
  })
}
