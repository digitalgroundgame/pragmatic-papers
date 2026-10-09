import { env, type Integration } from "../types"

/**
 * A link in a post: the text as shown, which Bluesky shortens, and where it leads. A link card
 * has no text.
 */
export interface PostLink {
  text: string
  url: string
}

/** One of the account's own posts. */
export interface BlueskyPost {
  /** The post's AT URI, stable across reads. */
  uri: string
  text: string
  /** The links in `text`, in order, then the link card's. */
  links: PostLink[]
  /** The post on bsky.app. */
  url: string
  /** When the author wrote it (ISO 8601). */
  createdAt: string
}

export interface BlueskyAccountsIntegration extends Integration {
  /**
   * The accounts to read: `handles` when it has any (the admin's list), else the handles
   * variable, else the default.
   */
  handles(handles?: readonly string[] | null): string[]
  /**
   * One account's newest posts, newest first: its own top-level posts only, no replies and no
   * reposts. Throws when Bluesky refuses the request.
   */
  recentPosts(opts: {
    handle: string
    limit?: number
    fetchImpl?: typeof fetch
    signal?: AbortSignal
  }): Promise<BlueskyPost[]>
}

export interface BlueskyAccountsOptions {
  id: string
  label: string
  defaultHandles: readonly string[]
  /** Environment variable holding handles, comma separated, for when the admin lists none. */
  handlesEnv: string
}

/** Bluesky's public AppView: unauthenticated reads of public data, no key needed. */
const API = "https://public.api.bsky.app/xrpc"

interface AuthorFeed {
  feed?: {
    post?: {
      uri?: string
      author?: { handle?: string }
      record?: { text?: string; createdAt?: string; facets?: Facet[] }
      /** A link card, when the post has one. */
      embed?: { external?: { uri?: string } }
    }
    reason?: { $type?: string }
  }[]
  message?: string
}

const list = (handles: readonly string[]): string[] => [
  ...new Set(handles.map((handle) => handle.trim().replace(/^@/, "")).filter(Boolean)),
]

interface Facet {
  /** UTF-8 byte offsets into the text. */
  index?: { byteStart?: number; byteEnd?: number }
  features?: { $type?: string; uri?: string }[]
}

/** The links a post's facets mark, as the text shows them. */
function facetLinks(text: string, facets: Facet[] = []): PostLink[] {
  const bytes = new TextEncoder().encode(text)
  const decoder = new TextDecoder()
  return facets.flatMap(({ index, features }) => {
    const uri = features?.find((f) => f.$type === "app.bsky.richtext.facet#link")?.uri
    const { byteStart, byteEnd } = index ?? {}
    if (!uri || byteStart === undefined || byteEnd === undefined) return []
    const shown = decoder.decode(bytes.subarray(byteStart, byteEnd))
    return shown ? [{ text: shown, url: uri }] : []
  })
}

/** The links, and the link card's after them when it leads somewhere none of them does. */
function withCard(links: PostLink[], card: string | undefined): PostLink[] {
  return card && !links.some((link) => link.url === card)
    ? [...links, { text: "", url: card }]
    : links
}

/**
 * A connection to our Bluesky accounts, for reading their public posts. It needs no
 * credentials, so it is always configured.
 */
export function blueskyAccounts({
  id,
  label,
  defaultHandles,
  handlesEnv,
}: BlueskyAccountsOptions): BlueskyAccountsIntegration {
  const handles = (chosen?: readonly string[] | null): string[] => {
    for (const candidate of [chosen ?? [], (env(handlesEnv) ?? "").split(","), defaultHandles]) {
      const found = list(candidate)
      if (found.length > 0) return found
    }
    return []
  }
  return {
    id,
    label,
    service: "Bluesky",
    describe: () =>
      handles()
        .map((handle) => `bluesky:@${handle}`)
        .join(", "),
    required: [],
    optional: [handlesEnv],
    handles,
    async recentPosts({ handle, limit = 5, fetchImpl = fetch, signal }) {
      const actor = handle.trim().replace(/^@/, "")
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
              links: withCard(
                facetLinks(post.record!.text!, post.record?.facets),
                post.embed?.external?.uri,
              ),
              url: `https://bsky.app/profile/${actor}/post/${rkey}`,
              createdAt,
            },
          ]
        })
        .slice(0, limit)
    },
  }
}
