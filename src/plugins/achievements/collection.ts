import {
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionConfig,
  type CollectionSlug,
  type Field,
  type FieldAccess,
  ValidationError,
} from "payload"

import { fillFirstMembers } from "./award"
import { ACHIEVEMENTS_SLUG, AWARDING, AWARDS_SLUG } from "./constants"
import { mineEndpoint } from "./endpoints/mine"
import { findRule, RULES } from "./rules"
import type { AchievementDoc, ResolvedAchievementsConfig } from "./types"

const invalid = (collection: string, path: string, message: string) =>
  new ValidationError({ collection, errors: [{ path, message }] })

/**
 * A `firstMembers` achievement goes to the members the site already has when it's created, and
 * to more of them when its limit is raised. Lowering the limit takes nothing away.
 */
export const fillOnSave =
  (config: ResolvedAchievementsConfig): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, operation, req }) => {
    const achievement = doc as AchievementDoc
    if (achievement.rule !== "firstMembers") return doc
    const raised =
      operation === "create" || (achievement.limit ?? 0) > ((previousDoc?.limit as number) ?? 0)
    if (raised) await fillFirstMembers(req.payload, achievement, config, req)
    return doc
  }

/** Deleting an achievement deletes its awards: nobody holds an achievement that's gone. */
export const deleteAchievementsAwards: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: AWARDS_SLUG as CollectionSlug,
    where: { achievement: { equals: id } },
    overrideAccess: true,
    req,
  })
}

/**
 * The achievements editors define. The rule each is earned by is code (`RULES`); the name,
 * description, badge and order are theirs. Dragging them into order decides which badge shows
 * when someone holds several.
 */
export function achievementsCollection(config: ResolvedAchievementsConfig): CollectionConfig {
  return {
    slug: ACHIEVEMENTS_SLUG,
    labels: { singular: "Achievement", plural: "Achievements" },
    orderable: true,
    admin: {
      group: config.adminGroup,
      useAsTitle: "name",
      defaultColumns: ["name", "rule", "badge"],
      description:
        "Readers' achievements. Drag them into order: of the badges someone holds, the highest shows beside their name. Give or revoke one from a user's record.",
    },
    access: {
      read: config.moderators,
      create: config.moderators,
      update: config.moderators,
      delete: config.admins,
    },
    hooks: {
      afterChange: config.disabled ? [] : [fillOnSave(config)],
      beforeDelete: [deleteAchievementsAwards],
    },
    endpoints: config.disabled ? [] : [mineEndpoint(config)],
    fields: [
      { name: "name", type: "text", required: true, maxLength: 40 },
      {
        name: "description",
        type: "textarea",
        maxLength: 200,
        admin: { description: "What it means, on the reader's account page." },
      },
      {
        name: "rule",
        label: "Earned by",
        type: "select",
        required: true,
        defaultValue: "manual",
        options: RULES.map(({ key, label }) => ({ label, value: key })),
        // Its awards were made under this rule: a new rule is a new achievement.
        access: { update: () => false },
        admin: {
          description: `Fixed once it's made. ${RULES.map((rule) => `${rule.label}: ${rule.description}`).join(" ")}`,
        },
      },
      {
        name: "limit",
        label: "How many members",
        type: "number",
        min: 1,
        validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
          siblingData.rule === "firstMembers" && !(typeof value === "number" && value >= 1)
            ? "Say how many members get it."
            : true,
        admin: {
          condition: (_data, siblingData) => siblingData?.rule === "firstMembers",
          description:
            "Raising it awards it to the next members in sign-up order; lowering it takes nothing away.",
        },
      },
      {
        name: "badge",
        label: "Show as a badge beside their name",
        type: "checkbox",
        defaultValue: true,
      },
    ],
    timestamps: true,
  }
}

/**
 * A row made in the admin either gives an achievement that's given by hand, or revokes one.
 * Earned achievements are never handed out. An account has one row per achievement, so
 * revoking one it was awarded means opening the row it already has. Ticking Revoked stamps who
 * and when; unticking it reinstates it and clears them.
 */
export const awardChanges: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
  context,
}) => {
  if (operation === "create" && !context[AWARDING]) {
    const achievement = data.achievement
      ? ((await req.payload.findByID({
          collection: ACHIEVEMENTS_SLUG as CollectionSlug,
          id: data.achievement,
          depth: 0,
          overrideAccess: true,
          disableErrors: true,
          req,
        })) as unknown as AchievementDoc | null)
      : null
    const name = achievement?.name ?? "this achievement"
    const byHand = findRule(achievement?.rule)?.source === "manual"
    if (!byHand && !data.revoked) {
      throw invalid(
        AWARDS_SLUG,
        "revoked",
        `${name} is earned, not given: tick Revoked to take it away.`,
      )
    }
    const existing = await req.payload.count({
      collection: AWARDS_SLUG as CollectionSlug,
      where: {
        and: [{ user: { equals: data.user } }, { achievement: { equals: data.achievement } }],
      },
      overrideAccess: true,
      req,
    })
    if (existing.totalDocs > 0) {
      throw invalid(
        AWARDS_SLUG,
        "achievement",
        `This user already has a row for ${name}: open it and tick Revoked there.`,
      )
    }
    if (byHand && !data.revoked) data.earnedAt = new Date().toISOString()
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
 * Who holds which achievement, and revocations. Off the sidebar: moderators reach it from a
 * user's record (`awardsJoinField`). An account achievement (Verified) has no row until a
 * moderator revokes it. Rows stay as a record: only admins delete them.
 */
export function awardsCollection(config: ResolvedAchievementsConfig): CollectionConfig {
  const fixedOnceMade = { update: () => false }
  return {
    slug: AWARDS_SLUG,
    labels: { singular: "Award", plural: "Awards" },
    admin: {
      // Off the sidebar, but its routes stay, so a user's record can open and add rows.
      group: false,
      defaultColumns: ["user", "achievement", "earnedAt", "revoked", "revokedAt"],
    },
    access: {
      read: config.moderators,
      create: config.moderators,
      update: config.moderators,
      delete: config.admins,
    },
    indexes: [{ fields: ["user", "achievement"], unique: true }],
    hooks: { beforeChange: [awardChanges] },
    fields: [
      {
        name: "user",
        type: "relationship",
        relationTo: config.usersSlug,
        index: true,
        access: fixedOnceMade,
        // Not required in the database: a first-members award outlives a deleted account.
        validate: (value: unknown, { operation }: { operation?: string }) =>
          operation === "create" && !value ? "Choose the user." : true,
        admin: {
          description: "Empty once the account is deleted: the row keeps its place in the count.",
        },
      },
      {
        name: "achievement",
        type: "relationship",
        relationTo: ACHIEVEMENTS_SLUG as CollectionSlug,
        required: true,
        index: true,
        access: fixedOnceMade,
      },
      {
        name: "earnedAt",
        label: "Earned",
        type: "date",
        admin: {
          readOnly: true,
          description: "When it was earned or given. Empty on a revocation of Verified.",
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

/**
 * The user's awards, listed on their record, where moderators give one that's given by hand
 * (Add new) or open one to revoke it. Account achievements (Verified) aren't listed until
 * they're revoked: add a row for one, ticking Revoked.
 */
export function awardsJoinField(config: ResolvedAchievementsConfig): Field {
  const moderators: FieldAccess = async (args) => Boolean(await config.moderators(args as never))
  return {
    name: "awards",
    label: "Achievements",
    type: "join",
    collection: AWARDS_SLUG as CollectionSlug,
    on: "user",
    defaultSort: "-earnedAt",
    access: { read: moderators },
    admin: {
      allowCreate: true,
      defaultColumns: ["achievement", "earnedAt", "revoked"],
      description:
        "Give an achievement that's given by hand with Add new, or open one to revoke it. Verified isn't listed until it's revoked: add a row for it with Revoked ticked.",
    },
  }
}
