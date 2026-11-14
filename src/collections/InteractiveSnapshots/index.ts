import type {
  CollectionBeforeChangeHook,
  CollectionConfig,
  FieldAccess,
  PayloadRequest,
} from "payload"

import { admin, editor } from "@/access/collections"
import { isPublishedOrStaff } from "@/access/policies"
import { isEditor } from "@/access/roles"
import { profileKind } from "@/interactives/profiles"
import { parseWhipCount, WHIP_COUNT_SCHEMA } from "@/interactives/whip-count/model"
import { isWhipCountData, whipCountSnapshotStamp } from "@/interactives/whip-count/snapshot"

import { revalidateSnapshot, revalidateSnapshotDelete } from "./hooks/revalidateSnapshot"

/**
 * Denies every write to a sync-owned field, for everyone, on every transport. The sync writes
 * through the Local API with `overrideAccess: true`, which is the point of the flag — see
 * `collections/Merch` for why `admin.readOnly` alone is not a permission.
 */
const syncOwned: FieldAccess = () => false
const syncOwnedAdmin = { readOnly: true, disableBulkEdit: true } as const

/** Whether a snapshot's `interactive` names a whip count interactive, drafts included. */
async function forWhipCount(req: PayloadRequest, interactive: unknown): Promise<boolean> {
  const id =
    typeof interactive === "object" && interactive !== null && "id" in interactive
      ? (interactive as { id: unknown }).id
      : interactive
  if (typeof id !== "number" && typeof id !== "string") return false
  const doc = await req.payload
    .findByID({
      req,
      collection: "interactives",
      id,
      draft: true,
      depth: 0,
      select: { profile: true },
    })
    .catch(() => null)
  return profileKind(doc?.profile) === "whip-count"
}

/**
 * A whip count's data is the one thing here an editor writes: positions, statements, blocs
 * and tags, row by row. A map's feed stays the sync's alone.
 */
const editableWhipCount: FieldAccess = ({ req, doc }) =>
  isEditor(req.user) && isWhipCountData(doc?.data)

/**
 * Keeps a whip count's provenance true to its data when an editor changes it in the table:
 * the hash the push route compares with, the summary, and the day it is as of.
 */
const stampWhipCount: CollectionBeforeChangeHook = ({ data }) => {
  const parsed = isWhipCountData(data.data) ? parseWhipCount(data.data) : null
  if (!parsed?.success) return data
  return { ...data, ...whipCountSnapshotStamp(parsed.value, new Date()) }
}

/**
 * Snapshots — the researcher's half of an interactive, as the sync job last
 * read it. One document per interactive; every sync that changes something writes a new
 * version, so the history and the rollback come from Payload's versions for free.
 *
 * The sync writes a **draft**. An editor previews the page (draft mode renders the draft
 * snapshot) and publishes it, and only then does it reach readers — unless the interactive's
 * feed is set to auto-publish. Nothing here is hand-edited: the fields are what upstream said,
 * validated against the profile's geometry before they were written. A feed that fails
 * validation never becomes a version, so the last good one keeps serving.
 *
 * A whip count's snapshot is the exception: there is no feed behind it. It is created by the
 * first push (`POST /next/whip-counts/<slug>`) or the seed, every push writes a version of it,
 * and editors change its count row by row (`WhipCountDataField`).
 */
export const InteractiveSnapshots: CollectionConfig = {
  slug: "interactive-snapshots",
  labels: {
    singular: "Snapshot",
    plural: "Snapshots",
  },
  access: {
    // Rows come from the sync; a hand-made one has no feed behind it. A whip count has no
    // feed, so an editor may create its snapshot with a count in it (the showcase does, over
    // REST), and only for a whip count interactive: a map's snapshot holding a count would
    // block its sync. Without a count to check, as when the admin asks whether to offer
    // Create, no.
    create: async ({ req, data }) =>
      isEditor(req.user) &&
      isWhipCountData(data?.data) &&
      (await forWhipCount(req, data?.interactive)),
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
    beforeChange: [stampWhipCount],
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
      // The validated feed (`DrilldownData`), megabytes and never shown, or a whip count,
      // which editors change in a table. The field component draws nothing for a feed.
      name: "data",
      type: "json",
      required: true,
      access: { update: editableWhipCount },
      admin: {
        components: {
          Field:
            "@/collections/InteractiveSnapshots/components/WhipCountDataField#WhipCountDataField",
        },
        description: `A whip count: every voter's public position, edited row by row. To replace it whole, use "Edit as JSON" and paste a document (schema "${WHIP_COUNT_SCHEMA}"). Saving checks it and says what is wrong.`,
      },
      validate: (value: unknown, { previousValue }: { previousValue?: unknown }): true | string => {
        if (isWhipCountData(value)) {
          const parsed = parseWhipCount(value)
          return parsed.success ? true : parsed.error
        }
        // A count can't be turned into something the page can't draw.
        if (isWhipCountData(previousValue)) {
          return `"schema" must be "${WHIP_COUNT_SCHEMA}".`
        }
        return true
      },
    },
  ],
  versions: {
    drafts: true,
    // Daily syncs of a feed that changes a few times a month: this is months of history.
    maxPerDoc: 20,
  },
}
