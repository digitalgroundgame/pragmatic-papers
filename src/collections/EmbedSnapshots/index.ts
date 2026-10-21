import type { CollectionConfig } from "payload"

import { admin, staff } from "@/access/collections"
import { snapshotFields } from "@/blocks/SocialEmbed/snapshotFields"
import { SOCIAL_PLATFORMS } from "@/blocks/SocialEmbed/types"

/**
 * The latest oEmbed fetch of each embedded post, one row per `embedKey`. The daily
 * `refreshEmbedSnapshots` job writes it, and an article page shows the newer of this and the
 * snapshot saved in its own content, so a refresh never has to rewrite the article.
 */
export const EmbedSnapshots: CollectionConfig = {
  slug: "embed-snapshots",
  labels: { singular: "Embed", plural: "Embeds" },
  admin: {
    group: "System",
    useAsTitle: "url",
    defaultColumns: ["url", "platform", "snapshot.status", "snapshot.fetchedAt"],
    description: "Refreshed copies of the social posts articles embed. Written by a daily job.",
  },
  access: {
    create: admin,
    read: staff,
    update: admin,
    delete: admin,
  },
  fields: [
    {
      name: "key",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, hidden: true },
    },
    { name: "url", type: "text", required: true, label: "URL", admin: { readOnly: true } },
    {
      name: "platform",
      type: "select",
      options: [...SOCIAL_PLATFORMS],
      required: true,
      admin: { readOnly: true },
    },
    { name: "hideMedia", type: "checkbox", admin: { readOnly: true, hidden: true } },
    { name: "hideThread", type: "checkbox", admin: { readOnly: true, hidden: true } },
    {
      name: "snapshot",
      type: "group",
      interfaceName: "SocialEmbedSnapshot",
      fields: snapshotFields,
      admin: { readOnly: true },
    },
  ],
}
