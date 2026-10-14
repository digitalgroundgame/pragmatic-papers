import {
  type CollectionBeforeChangeHook,
  type CollectionConfig,
  type CollectionSlug,
  ValidationError,
} from "payload"

import { ACHIEVEMENTS_SLUG, AWARDING } from "./constants"
import { mineEndpoint } from "./endpoints/mine"
import { ACHIEVEMENTS, findAchievement } from "./registry"
import type { ResolvedAchievementsConfig } from "./types"

const invalid = (path: string, message: string) =>
  new ValidationError({ collection: ACHIEVEMENTS_SLUG, errors: [{ path, message }] })

/**
 * A row made in the admin only ever revokes: achievements are earned, never handed out. An
 * account has one row per achievement, so revoking an awarded one means opening the row it
 * already has. Ticking Revoked stamps who and when; unticking it reinstates it and clears them.
 */
export const revocations: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
  context,
}) => {
  if (operation === "create" && !context[AWARDING]) {
    if (!data.revoked) {
      throw invalid(
        "revoked",
        "Achievements are earned, not given here: tick Revoked to take one away.",
      )
    }
    const existing = await req.payload.count({
      collection: ACHIEVEMENTS_SLUG as CollectionSlug,
      where: {
        and: [{ user: { equals: data.user } }, { achievement: { equals: data.achievement } }],
      },
      overrideAccess: true,
      req,
    })
    if (existing.totalDocs > 0) {
      const label = findAchievement(data.achievement)?.label ?? "this achievement"
      throw invalid(
        "achievement",
        `This reader already has a row for ${label}: open it and tick Revoked there.`,
      )
    }
  }

  const wasRevoked = operation === "update" && originalDoc?.revoked === true
  if (data.revoked && !wasRevoked) {
    data.revokedAt = new Date().toISOString()
    data.revokedBy = req.user?.id ?? null
  } else if (data.revoked === false && wasRevoked) {
    data.revokedAt = null
    data.revokedBy = null
    data.revokedReason = null
  }
  return data
}

/**
 * Awarded achievements, and revocations. An account achievement (Verified) has no row until a
 * moderator revokes it. Rows stay as a record: only admins delete them.
 */
export function achievementsCollection(config: ResolvedAchievementsConfig): CollectionConfig {
  const fixedOnceMade = { update: () => false }
  return {
    slug: ACHIEVEMENTS_SLUG,
    labels: { singular: "Achievement", plural: "Achievements" },
    admin: {
      group: config.adminGroup,
      useAsTitle: "achievement",
      defaultColumns: ["user", "achievement", "earnedAt", "revoked", "revokedAt"],
      description:
        "Readers' achievements. To take one away, open the reader's row, tick Revoked and give a reason. Verified has no row until it's revoked: create one, choose the reader and Verified, and tick Revoked.",
    },
    access: {
      read: config.moderators,
      create: config.moderators,
      update: config.moderators,
      delete: config.admins,
    },
    indexes: [{ fields: ["user", "achievement"], unique: true }],
    hooks: { beforeChange: [revocations] },
    endpoints: config.disabled ? [] : [mineEndpoint(config)],
    fields: [
      {
        name: "user",
        label: "Reader",
        type: "relationship",
        relationTo: config.usersSlug,
        index: true,
        access: fixedOnceMade,
        // Not required in the database: an Early member row outlives a deleted account.
        validate: (value: unknown, { operation }: { operation?: string }) =>
          operation === "create" && !value ? "Choose the reader." : true,
        admin: {
          description: "Empty once the account is deleted: the row keeps its place in the count.",
        },
      },
      {
        name: "achievement",
        type: "select",
        required: true,
        index: true,
        access: fixedOnceMade,
        options: ACHIEVEMENTS.map(({ key, label }) => ({ label, value: key })),
      },
      {
        name: "earnedAt",
        label: "Earned",
        type: "date",
        admin: {
          readOnly: true,
          description: "When an awarded achievement was earned. Empty on a revocation of Verified.",
          date: { pickerAppearance: "dayAndTime" },
        },
      },
      {
        name: "revoked",
        type: "checkbox",
        defaultValue: false,
        index: true,
        admin: { description: "Takes the achievement away. Untick it to give it back." },
      },
      {
        name: "revokedReason",
        label: "Why it was revoked",
        type: "textarea",
        validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
          siblingData.revoked && !(typeof value === "string" && value.trim())
            ? "Give a reason for revoking it."
            : true,
        admin: { condition: (_data, siblingData) => siblingData?.revoked === true },
      },
      {
        name: "revokedAt",
        label: "Revoked on",
        type: "date",
        admin: {
          readOnly: true,
          position: "sidebar",
          date: { pickerAppearance: "dayAndTime" },
        },
      },
      {
        name: "revokedBy",
        label: "Revoked by",
        type: "relationship",
        relationTo: config.usersSlug,
        admin: { readOnly: true, position: "sidebar" },
      },
    ],
    timestamps: true,
  }
}
