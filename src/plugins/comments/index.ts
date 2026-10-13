import type { CollectionConfig, Plugin } from "payload"

import { readersCollection } from "./collections/Readers"
import { commentsCollection } from "./collections/Comments"
import { DEFAULT_COOKIE_NAME } from "./constants"
import { readerAuthEndpoints } from "./endpoints/auth"
import { deleteCommentsOn } from "./hooks/deleteCommentsOn"
import type { CommentsPluginConfig, ResolvedCommentsConfig } from "./types"

export { DEFAULT_COOKIE_NAME as READER_COOKIE_NAME, PROVIDER_LABELS } from "./constants"
export { commentsAfterSchemaInit } from "./schema"
export type {
  CommentThread,
  CommentViewer,
  CommentsPluginConfig,
  PublicComment,
  ReaderProviderCredentials,
  ReaderProviderId,
} from "./types"

/**
 * Comments on articles, from readers who sign in with Google or Discord.
 *
 * Readers are their own collection, apart from staff `users`: Better Auth creates one on their
 * first provider login and keeps its sessions in its own tables (`commentsAfterSchemaInit`,
 * which goes in the database adapter's `afterSchemaInit`), and a reader has no way into the
 * admin. Pages don't render comments; they load them from `/api/comments/thread/:id`, so a
 * page stays one cached copy for everyone. Moderators hide or delete comments, and ban readers,
 * in the admin.
 */
export function commentsPlugin(options: CommentsPluginConfig): Plugin {
  const comments: ResolvedCommentsConfig = {
    enabled: () => true,
    targetSlug: "articles",
    adminGroup: "Content",
    cookieName: DEFAULT_COOKIE_NAME,
    sessionSeconds: 60 * 60 * 24 * 30,
    maxLength: 2000,
    cooldownSeconds: 20,
    ...options,
  }

  return (config) => {
    const collection = commentsCollection(comments)
    const collections = [
      ...(config.collections ?? []).map((target): CollectionConfig => {
        if (target.slug !== comments.targetSlug) return target
        // Deleting an article deletes its comments.
        return {
          ...target,
          hooks: {
            ...target.hooks,
            beforeDelete: [...(target.hooks?.beforeDelete ?? []), deleteCommentsOn("target")],
          },
        }
      }),
      readersCollection(comments),
      options.disabled ? { ...collection, endpoints: [] } : collection,
    ]

    if (options.disabled) return { ...config, collections }

    return {
      ...config,
      collections,
      endpoints: [...(config.endpoints ?? []), ...readerAuthEndpoints(comments)],
    }
  }
}
