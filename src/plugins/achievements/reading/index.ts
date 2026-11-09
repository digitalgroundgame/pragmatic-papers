import type { CollectionConfig, Config } from "payload"

import type { ResolvedAchievementsConfig } from "../types"
import { readsCollection, visitsField } from "./collection"
import { mineEndpoint, readingEndpoint } from "./endpoints/reading"
import { deleteArticlesReads, deleteUsersReads } from "./hooks/deleteReads"
import type { ResolvedReadingConfig } from "./types"

/** Reading's view of the achievements plugin's options. */
export const resolveReadingConfig = (
  achievements: ResolvedAchievementsConfig,
): ResolvedReadingConfig => ({
  usersSlug: achievements.usersSlug,
  articlesSlug: achievements.reading.articlesSlug ?? "articles",
  groups: achievements.reading.groups,
  currentUser: achievements.currentUser,
  readers: achievements.admins,
  disabled: achievements.disabled,
  enabled: achievements.enabled,
})

/**
 * What signed-in readers read, for achievements to count: a row per article read to the end,
 * and on each account the days visited and the current and longest streak. It records only
 * while achievements are switched on. Adds the reads collection, the visits on each user, the
 * hooks that delete reads with their account or article, and the endpoints the page reports to
 * (`POST /api/reading`) and the account page reads (`GET /api/reading/mine`).
 */
export function withReading(config: Config, reading: ResolvedReadingConfig): Config {
  const collections = (config.collections ?? []).map((existing): CollectionConfig => {
    if (existing.slug === reading.usersSlug) {
      return {
        ...existing,
        fields: [...existing.fields, visitsField(reading)],
        hooks: reading.disabled
          ? existing.hooks
          : {
              ...existing.hooks,
              beforeDelete: [...(existing.hooks?.beforeDelete ?? []), deleteUsersReads],
            },
      }
    }
    if (existing.slug === reading.articlesSlug && !reading.disabled) {
      return {
        ...existing,
        hooks: {
          ...existing.hooks,
          beforeDelete: [...(existing.hooks?.beforeDelete ?? []), deleteArticlesReads],
        },
      }
    }
    return existing
  })
  return {
    ...config,
    collections: [...collections, readsCollection(reading)],
    endpoints: reading.disabled
      ? config.endpoints
      : [...(config.endpoints ?? []), readingEndpoint(reading), mineEndpoint(reading)],
  }
}
