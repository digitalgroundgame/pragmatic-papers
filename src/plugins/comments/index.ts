import type { CollectionConfig } from "payload"

import { isPluginOn, registerPlugin } from "@/utilities/registerPlugin"

import { commentsCollection } from "./collections/Comments"
import { violationsCollection } from "./collections/Violations"
import { deleteAuthorsComments, deleteCommentsOnTarget } from "./hooks/deleteCommentsOn"
import { settingsGlobal } from "./settings"
import type { CommentAuthor, CommentsPluginConfig, ResolvedCommentsConfig } from "./types"

export { countLinks } from "./checks"
export { lockFor } from "./lock"
export type {
  AuthorDisplay,
  CommentAuthor,
  CommentCheck,
  CommentSettings,
  CommentThread,
  CommentViewer,
  CommentsPluginConfig,
  PublicComment,
  SignInProvider,
} from "./types"

const defaultDescribeAuthor = (author: CommentAuthor) => ({
  name: typeof author.name === "string" && author.name ? author.name : "Anonymous",
  image: null,
  badge: null,
})

/**
 * Comments on a collection's documents, with replies, checks that hold suspect comments back,
 * and violations that stop repeat offenders commenting for a while.
 *
 * The plugin doesn't sign anyone in: `currentUser` says who is asking, however the site knows
 * them. Pages don't render comments; they load them from `/api/comments/thread/:id`, so a page
 * stays one cached copy for everyone. Moderators hide, restore and delete comments and manage
 * violations in the admin; admins set the reply depth and the checks in its settings global.
 */
export const commentsPlugin = registerPlugin<CommentsPluginConfig>({
  slug: "comments",
  manifest: {
    name: "Comments",
    source: "src/plugins/comments",
    description:
      "Comments under articles, with replies, checks that hold suspect comments back and violations that stop repeat offenders. Moderators work in Content → Comments; admins set the rules in Comment settings.",
    switch: {
      label: "Comments",
      description:
        "The Comments section under each article, and sign-ups: readers make an account by signing in to comment. Needs Single sign-on on too.",
      defaultValue: false,
    },
  },
  plugin: ({ config, plugins: _plugins, ...options }) => {
    const comments: ResolvedCommentsConfig = {
      targetSlug: "articles",
      authorsSlug: "users",
      authorFields: ["name"],
      describeAuthor: defaultDescribeAuthor,
      authorBadges: async () => new Map(),
      checks: [],
      isVerified: (author) => author.emailVerified === true,
      signInProviders: () => [],
      adminGroup: "Content",
      maxLength: 2000,
      cooldownSeconds: 20,
      ...options,
      enabled: ({ payload }) => isPluginOn(options.enabled, payload),
    }

    const collection = commentsCollection(comments)
    const withHook = (target: CollectionConfig, hook: typeof deleteCommentsOnTarget) => ({
      ...target,
      hooks: { ...target.hooks, beforeDelete: [...(target.hooks?.beforeDelete ?? []), hook] },
    })
    const collections = [
      ...(config.collections ?? []).map((existing): CollectionConfig => {
        if (existing.slug === comments.targetSlug) {
          return withHook(existing, deleteCommentsOnTarget)
        }
        if (existing.slug === comments.authorsSlug) {
          return withHook(existing, deleteAuthorsComments)
        }
        return existing
      }),
      options.disabled ? { ...collection, endpoints: [] } : collection,
      violationsCollection(comments),
    ]

    return {
      ...config,
      collections,
      globals: [...(config.globals ?? []), settingsGlobal(comments)],
    }
  },
})
