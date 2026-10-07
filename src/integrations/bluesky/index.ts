import { env, type Integration } from "../types"

/** One of the account's own posts. */
export interface BlueskyPost {
  /** The post's AT URI, stable across reads. */
  uri: string
  text: string
  /** The post on bsky.app. */
  url: string
  /** When the author wrote it (ISO 8601). */
  createdAt: string
}

export interface BlueskyAccountIntegration extends Integration {
  handle(): string
  /**
   * The account's newest posts, newest first: its own top-level posts only, no replies and no
   * reposts. Throws when Bluesky refuses the request.
   */
  recentPosts(opts?: {
    limit?: number
    fetchImpl?: typeof fetch
    signal?: AbortSignal
  }): Promise<BlueskyPost[]>
}

export interface BlueskyAccountOptions {
  id: string
  label: string
  defaultHandle: string
  /** Environment variable that points the connection at another account. */
  handleEnv: string
}

/** Bluesky's public AppView: unauthenticated reads of public data, no key needed. */
const API = "https://public.api.bsky.app/xrpc"

interface AuthorFeed {
  feed?: {
    post?: {
      uri?: string
      author?: { handle?: string }
      record?: { text?: string; createdAt?: string }
    }
    reason?: { $type?: string }
  }[]
  message?: string
}

/**
 * A connection to one Bluesky account, for reading its public posts. It needs no credentials,
 * so it is always configured.
 */
export function blueskyAccount({
  id,
  label,
  defaultHandle,
  handleEnv,
}: BlueskyAccountOptions): BlueskyAccountIntegration {
  const handle = (): string => (env(handleEnv) ?? defaultHandle).replace(/^@/, "")
  return {
    id,
    label,
    service: "Bluesky",
    describe: () => `bluesky:@${handle()}`,
    required: [],
    optional: [handleEnv],
    handle,
    async recentPosts({ limit = 5, fetchImpl = fetch, signal } = {}) {
      const actor = handle()
      const params = new URLSearchParams({
        actor,
        filter: "posts_no_replies",
        // Reposts are dropped below, so ask for a few more than will be kept.
        limit: String(Math.min(limit * 2, 100)),
      })
      const response = await fetchImpl(`${API}/app.bsky.feed.getAuthorFeed?${params}`, { signal })
      const body = (await response.json().catch(() => ({}))) as AuthorFeed
      if (!response.ok) {
        throw new Error(
          `Bluesky feed for @${actor} failed (HTTP ${response.status})${body.message ? `: ${body.message}` : ""}`,
        )
      }

      return (body.feed ?? [])
        .flatMap(({ post, reason }): BlueskyPost[] => {
          // A repost comes back as someone else's post with a `reason` saying who reposted it.
          if (reason || !post?.uri || post.author?.handle !== actor) return []
          const text = post.record?.text?.trim()
          const createdAt = post.record?.createdAt
          if (!text || !createdAt) return []
          const rkey = post.uri.split("/").pop()!
          return [
            {
              uri: post.uri,
              text,
              url: `https://bsky.app/profile/${actor}/post/${rkey}`,
              createdAt,
            },
          ]
        })
        .slice(0, limit)
    },
  }
}
