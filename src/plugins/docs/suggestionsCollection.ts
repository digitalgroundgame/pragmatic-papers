import { admin, editor } from "@/access/collections"
import type {
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionConfig,
} from "payload"

export const DOC_SUGGESTIONS_SLUG = "doc-suggestions"

export const SUGGESTION_STATUSES = [
  { label: "Open", value: "open" },
  { label: "Done", value: "resolved" },
  { label: "Dismissed", value: "dismissed" },
] as const

/** Records who closed a suggestion and when, and clears both when it's opened again. */
export const recordResolution: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  if (!data.status || data.status === originalDoc?.status) return data
  const closed = data.status !== "open"
  return {
    ...data,
    resolvedBy: closed ? (req.user?.id ?? null) : null,
    resolvedAt: closed ? new Date().toISOString() : null,
  }
}

/** Deletes a doc's suggestions with it. */
export const deleteDocSuggestions: CollectionAfterDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: DOC_SUGGESTIONS_SLUG,
    overrideAccess: true,
    req,
    where: { doc: { equals: id } },
  })
}

/**
 * The repo's changes to docs a site already has, for editors to work into the doc in their own
 * words. A deploy never changes a doc the site has: when the repo's copy changes, it saves what
 * changed here instead, beside the doc (`suggestChange`), and editors mark it done or dismiss
 * it. The doc, and every word readers see, stays the editors'.
 */
export const DocSuggestions: CollectionConfig<"doc-suggestions"> = {
  slug: DOC_SUGGESTIONS_SLUG,
  labels: { singular: "Suggestion", plural: "Suggestions" },
  access: {
    // Only deploys create them; editors close them, and admins clear old ones out.
    create: () => false,
    read: editor,
    update: editor,
    delete: admin,
  },
  admin: {
    group: "Help",
    useAsTitle: "title",
    defaultColumns: ["title", "doc", "status", "updatedAt"],
    description:
      "The repo's changes to docs this site has. Work each one into the doc in your own words, then mark it done, or dismiss it. Deploys never change the doc itself.",
  },
  defaultSort: "-updatedAt",
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      admin: { readOnly: true },
    },
    {
      name: "doc",
      type: "relationship",
      relationTo: "docs",
      // Required in spirit: a doc's suggestions are deleted with it (`deleteDocSuggestions`).
      index: true,
      admin: { readOnly: true, position: "sidebar" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "open",
      index: true,
      options: [...SUGGESTION_STATUSES],
      admin: {
        position: "sidebar",
        description:
          "Done once the doc says what changed, in your words. Dismissed if it doesn't need to.",
      },
    },
    {
      name: "resolvedBy",
      label: "Closed by",
      type: "relationship",
      relationTo: "users",
      admin: {
        position: "sidebar",
        readOnly: true,
        condition: (data) => Boolean(data?.resolvedBy),
      },
    },
    {
      name: "resolvedAt",
      label: "Closed",
      type: "date",
      admin: {
        position: "sidebar",
        readOnly: true,
        condition: (data) => Boolean(data?.resolvedAt),
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "note",
      label: "What changed",
      type: "textarea",
      admin: {
        readOnly: true,
        description: "From the pull request that changed the feature.",
      },
    },
    {
      name: "changes",
      label: "Changes to the repo's copy",
      type: "textarea",
      admin: {
        readOnly: true,
        components: { Field: "@/plugins/docs/exports/client#SuggestionChanges" },
      },
    },
    {
      name: "pictures",
      type: "upload",
      relationTo: "media",
      hasMany: true,
      admin: {
        readOnly: true,
        description: "New or changed pictures, uploaded to Media for you to use.",
        condition: (data) => Boolean(data?.pictures?.length),
      },
    },
    // What the diff runs between, kept so a later change can join an open suggestion.
    { name: "fromSource", type: "textarea", admin: { hidden: true } },
    { name: "toSource", type: "textarea", admin: { hidden: true } },
    { name: "fromHash", type: "text", admin: { hidden: true } },
    { name: "toHash", type: "text", admin: { hidden: true } },
  ],
  hooks: {
    beforeChange: [recordResolution],
  },
}
