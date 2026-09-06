import type { CollectionConfig, FieldAccess, PayloadRequest } from "payload"

import { admin, editor } from "@/access/collections"
import { isPublishedOrStaff } from "@/access/policies"
import { isEditor } from "@/access/roles"

import { revalidateSnapshot, revalidateSnapshotDelete } from "./hooks/revalidateSnapshot"

/**
 * Denies every write to a sync-owned field, for everyone, on every transport. The sync writes
 * through the Local API with `overrideAccess: true`, which is the point of the flag — see
 * `collections/Merch` for why `admin.readOnly` alone is not a permission.
 */
const syncOwned: FieldAccess = () => false
const syncOwnedAdmin = { readOnly: true, disableBulkEdit: true } as const

/**
 * Interactive Snapshots — the researcher's half of an interactive, as the sync job last
 * read it. One document per interactive; every sync that changes something writes a new
 * version, so the history and the rollback come from Payload's versions for free.
 *
 * The sync writes a **draft**. An editor previews the page (draft mode renders the draft
 * snapshot) and publishes it, and only then does it reach readers — unless the interactive's
 * feed is set to auto-publish. Nothing here is hand-edited: the fields are what upstream said,
 * validated against the profile's geometry before they were written. A feed that fails
 * validation never becomes a version, so the last good one keeps serving.
 */
export const InteractiveSnapshots: CollectionConfig = {
  slug: "interactive-snapshots",
  labels: {
    singular: "Interactive Snapshot",
    plural: "Interactive Snapshots",
  },
  access: {
    // Rows come from the sync; a hand-made one has no feed behind it.
    create: () => false,
    delete: admin,
    // Editors publish and unpublish; the fields themselves are sync-owned.
    update: editor,
    read: isPublishedOrStaff,
  },
  admin: {
    components: {
      beforeListTable: [
        "@/collections/InteractiveSnapshots/components/SyncNowButton#SyncNowButton",
      ],
    },
    useAsTitle: "label",
    defaultColumns: ["label", "interactive", "sourceVersion", "generatedAt", "syncedAt", "_status"],
    description:
      "What the researcher's feed said the last time the sync read it. Each sync that changes the data writes a new draft version; publish it to put it in front of readers, or set the interactive's feed to auto-publish. Fields are read-only — the feed is the source of truth.",
    group: "Interactives",
  },
  hooks: {
    afterChange: [revalidateSnapshot],
    afterDelete: [revalidateSnapshotDelete],
  },
  endpoints: [
    {
      // Mounted at /api/interactive-snapshots/sync. A collection endpoint rather than a root
      // one, for the reason `collections/Merch` gives: root endpoints match after collection
      // routes. Runs the same task the schedule runs; `interactive` narrows it to one
      // document, `force` re-reads even when upstream's version stamp has not moved.
      path: "/sync",
      method: "post",
      handler: async (req: PayloadRequest): Promise<Response> => {
        if (!isEditor(req.user)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 })
        }
        const url = new URL(req.url ?? "http://localhost")
        const interactive = url.searchParams.get("interactive")
        const force = url.searchParams.get("force") === "true"
        const job = await req.payload.jobs.queue({
          task: "syncInteractiveData",
          input: {
            ...(interactive ? { interactiveId: Number(interactive) } : {}),
            force,
          },
        })
        const result = await req.payload.jobs.run({ queue: "default", limit: 1 })
        return Response.json({ jobId: job.id, result })
      },
    },
  ],
  fields: [
    {
      name: "label",
      type: "text",
      required: true,
      access: { update: syncOwned },
      admin: syncOwnedAdmin,
    },
    {
      name: "interactive",
      type: "relationship",
      relationTo: "interactives",
      required: true,
      unique: true,
      index: true,
      access: { update: syncOwned },
      admin: { ...syncOwnedAdmin, position: "sidebar" },
    },
    {
      name: "summary",
      type: "text",
      access: { update: syncOwned },
      admin: {
        ...syncOwnedAdmin,
        description: "What the feed contained — regions, records and extra datasets.",
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "sourceVersion",
          type: "text",
          required: true,
          access: { update: syncOwned },
          admin: {
            ...syncOwnedAdmin,
            width: "33%",
            description: "Upstream's own build stamp.",
          },
        },
        {
          name: "sourceRef",
          type: "text",
          access: { update: syncOwned },
          admin: { ...syncOwnedAdmin, width: "33%", description: "Branch, tag or commit read." },
        },
        {
          name: "contentHash",
          type: "text",
          required: true,
          access: { update: syncOwned },
          admin: {
            ...syncOwnedAdmin,
            width: "33%",
            description: "Hash of what we render; a new version exists only when this moves.",
          },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "generatedAt",
          type: "date",
          required: true,
          access: { update: syncOwned },
          admin: {
            ...syncOwnedAdmin,
            width: "50%",
            description: "When upstream generated the data.",
            date: { pickerAppearance: "dayAndTime" },
          },
        },
        {
          name: "syncedAt",
          type: "date",
          required: true,
          access: { update: syncOwned },
          admin: {
            ...syncOwnedAdmin,
            width: "50%",
            description: "When the sync last confirmed this version.",
            date: { pickerAppearance: "dayAndTime" },
          },
        },
      ],
    },
    {
      // The validated feed (`DrilldownData`). Megabytes; never shown in a JSON editor.
      name: "data",
      type: "json",
      required: true,
      access: { update: syncOwned },
      admin: { ...syncOwnedAdmin, hidden: true },
    },
  ],
  versions: {
    drafts: true,
    // Daily syncs of a feed that changes a few times a month: this is months of history.
    maxPerDoc: 20,
  },
}
