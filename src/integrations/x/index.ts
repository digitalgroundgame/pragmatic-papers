import { env, type Integration } from "../types"

/** A link in a post's text: the t.co link the text holds, and where it leads. */
export interface PostLink {
  text: string
  url: string
}

/** One of the account's own posts. */
export interface XPost {
  id: string
  text: string
  /** The links in `text`, in order. */
  links: PostLink[]
  /** The post on x.com. */
  url: string
  /** When it was posted (ISO 8601). */
  createdAt: string
}

export interface XAccountsIntegration extends Integration {
  /**
   * The accounts to read: `usernames` when it has any (the admin's list), else the usernames
   * variable, else the default.
   */
  usernames(usernames?: readonly string[] | null): string[]
  /**
   * One account's newest posts, newest first: no replies and no reposts. Throws when the
   * connection is not configured or X refuses the request, with X's own error and never the
   * token.
   */
  recentPosts(opts: {
    username: string
    limit?: number
    fetchImpl?: typeof fetch
    signal?: AbortSignal
  }): Promise<XPost[]>
}

export interface XAccountsOptions {
  id: string
  label: string
  defaultUsernames: readonly string[]
  /** Environment variable holding usernames, comma separated, for when the admin lists none. */
  usernamesEnv: string
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

const list = (usernames: readonly string[]): string[] => [
  ...new Set(usernames.map((name) => name.trim().replace(/^@/, "")).filter(Boolean)),
]

/**
 * A connection to our X accounts, for reading their posts.
 *
 * Reading posts is not in X's free API tier: the app behind the token needs a paid plan or
 * pay-per-use credits. Each account is two reads (the username's ID, then its posts), so the
 * caller should cache the result for a long while.
 */
export function xAccounts({
  id,
  label,
  defaultUsernames,
  usernamesEnv,
  tokenEnv,
}: XAccountsOptions): XAccountsIntegration {
  const usernames = (chosen?: readonly string[] | null): string[] => {
    for (const candidate of [
      chosen ?? [],
      (env(usernamesEnv) ?? "").split(","),
      defaultUsernames,
    ]) {
      const found = list(candidate)
      if (found.length > 0) return found
    }
    return []
  }
  return {
    id,
    label,
    service: "X",
    describe: () =>
      usernames()
        .map((name) => `x:@${name}`)
        .join(", "),
    required: [tokenEnv],
    optional: [usernamesEnv],
    usernames,
    async recentPosts({ username, limit = 5, fetchImpl = fetch, signal }) {
      const token = env(tokenEnv)
      if (!token) throw new Error(`X needs ${tokenEnv}`)
      const name = username.trim().replace(/^@/, "")

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
        (await get<
          {
            id: string
            text: string
            created_at: string
            entities?: { urls?: { url?: string; expanded_url?: string }[] }
          }[]
        >(`users/${encodeURIComponent(user.id)}/tweets`, {
          // X's floor for this endpoint is 5.
          max_results: String(Math.min(Math.max(limit, 5), 100)),
          exclude: "replies,retweets",
          "tweet.fields": "created_at,entities",
        })) ?? []

      return posts.slice(0, limit).map((post) => ({
        id: post.id,
        text: post.text,
        links: (post.entities?.urls ?? []).flatMap(({ url, expanded_url }) =>
          url && expanded_url ? [{ text: url, url: expanded_url }] : [],
        ),
        url: `https://x.com/${name}/status/${post.id}`,
        createdAt: post.created_at,
      }))
    },
  }
}
