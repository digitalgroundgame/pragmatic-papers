import type { CollectionConfig, Payload } from "payload"

import { isPluginOn, registerPlugin } from "@/utilities/registerPlugin"

import { readsCollection, visitsField } from "./collection"
import { mineEndpoint, readingEndpoint } from "./endpoints/reading"
import { deleteArticlesReads, deleteUsersReads } from "./hooks/deleteReads"
import type { ReadingHistoryPluginConfig, ResolvedReadingHistoryConfig } from "./types"

export { MINE_PATH, READING_PATH } from "./constants"
export type { MyReading, ReadingGroups, ReadingHistoryPluginConfig, ReadingUser } from "./types"

const nobody = () => false

/** The plugin's options with their defaults filled in. */
export const resolveReadingHistoryConfig = (
  options: ReadingHistoryPluginConfig,
): ResolvedReadingHistoryConfig => ({
  usersSlug: "users",
  articlesSlug: "articles",
  readers: nobody,
  ...options,
  disabled: options.disabled === true,
  enabled: async (payload: Payload) =>
    !options.disabled && (await isPluginOn(options.enabled, payload)),
})

/**
 * What signed-in readers read and how often they visit, kept from the day it's installed so
 * achievements can count it later: one row per article read (to the end), and on each account
 * the days visited and the current and longest streak. The page reports it (`POST
 * /api/reading`); nothing is kept for anyone signed out. The account page reads the totals
 * (`GET /api/reading/mine`). Deleting an account deletes its history.
 */
export const readingHistoryPlugin = registerPlugin<ReadingHistoryPluginConfig>({
  slug: "reading-history",
  manifest: {
    name: "Reading history",
    source: "src/plugins/readingHistory",
    description:
      "Keeps the articles each signed-in reader reads to the end, and the days they visit, for achievements to count. Nothing is kept for readers who aren't signed in, and deleting an account deletes its history.",
  },
  plugin: ({ config, plugins: _plugins, ...options }) => {
    const reading = resolveReadingHistoryConfig(options)
    const collections = (config.collections ?? []).map((existing): CollectionConfig => {
      if (reading.disabled) {
        return existing.slug === reading.usersSlug
          ? { ...existing, fields: [...existing.fields, visitsField(reading)] }
          : existing
      }
      if (existing.slug === reading.usersSlug) {
        return {
          ...existing,
          fields: [...existing.fields, visitsField(reading)],
          hooks: {
            ...existing.hooks,
            beforeDelete: [...(existing.hooks?.beforeDelete ?? []), deleteUsersReads],
          },
        }
      }
      if (existing.slug === reading.articlesSlug) {
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
  },
})
