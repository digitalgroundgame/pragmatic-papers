import { env, type Integration } from "../types"

/** One of the account's own posts. */
export interface XPost {
  id: string
  text: string
  /** The post on x.com. */
  url: string
  /** When it was posted (ISO 8601). */
  createdAt: string
}

export interface XAccountIntegration extends Integration {
  username(): string
  /**
   * The account's newest posts, newest first: no replies and no reposts. Throws when the
   * connection is not configured or X refuses the request, with X's own error and never the
   * token.
   */
  recentPosts(opts?: {
    /** The account to read, as set in the admin; falls back to the username variable. */
    username?: string | null
    limit?: number
    fetchImpl?: typeof fetch
    signal?: AbortSignal
  }): Promise<XPost[]>
}

export interface XAccountOptions {
  id: string
  label: string
  defaultUsername: string
  /** Environment variable that points the connection at another account. */
  usernameEnv: string
  /** Environment variable holding an app-only Bearer Token from the X developer portal. */
  tokenEnv: string
}

const API = "https://api.x.com/2"

interface XEnvelope<T> {
  data?: T
  title?: string
  detail?: string
  errors?: { message?: string; detail?: string }[]
}

/**
 * A connection to one X account, for reading its posts.
 *
 * Reading posts is not in X's free API tier: the app behind the token needs a paid plan or
 * pay-per-use credits. Each call is two reads (the username's ID, then its posts), so the
 * caller should cache the result for a long while.
 */
export function xAccount({
  id,
  label,
  defaultUsername,
  usernameEnv,
  tokenEnv,
}: XAccountOptions): XAccountIntegration {
  const username = (): string => (env(usernameEnv) ?? defaultUsername).replace(/^@/, "")
  return {
    id,
    label,
    service: "X",
    describe: () => `x:@${username()}`,
    required: [tokenEnv],
    optional: [usernameEnv],
    username,
    async recentPosts({ username: chosen, limit = 5, fetchImpl = fetch, signal } = {}) {
      const token = env(tokenEnv)
      if (!token) throw new Error(`X needs ${tokenEnv}`)
      const name = chosen?.trim().replace(/^@/, "") || username()

      const get = async <T>(
        path: string,
        params?: Record<string, string>,
      ): Promise<T | undefined> => {
        const query = params ? `?${new URLSearchParams(params)}` : ""
        const response = await fetchImpl(`${API}/${path}${query}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal,
        })
        const body = (await response.json().catch(() => ({}))) as XEnvelope<T>
        if (!response.ok || (body.data === undefined && body.errors?.length)) {
          // A 200 carrying only `errors` is how X reports an unknown username.
          const reason =
            body.detail ?? body.title ?? body.errors?.map((e) => e.detail ?? e.message).join("; ")
          throw new Error(
            `X ${path} failed (HTTP ${response.status})${reason ? `: ${reason}` : ""}`,
          )
        }
        return body.data
      }

      const user = await get<{ id: string }>(`users/by/username/${encodeURIComponent(name)}`)
      if (!user) throw new Error(`X has no account @${name}`)
      // An account with no posts comes back with no `data` at all.
      const posts =
        (await get<{ id: string; text: string; created_at: string }[]>(
          `users/${encodeURIComponent(user.id)}/tweets`,
          {
            // X's floor for this endpoint is 5.
            max_results: String(Math.min(Math.max(limit, 5), 100)),
            exclude: "replies,retweets",
            "tweet.fields": "created_at",
          },
        )) ?? []

      return posts.slice(0, limit).map((post) => ({
        id: post.id,
        text: post.text,
        url: `https://x.com/${name}/status/${post.id}`,
        createdAt: post.created_at,
      }))
    },
  }
}
