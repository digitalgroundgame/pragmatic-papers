import {
  excerpt,
  mergePosts,
  postKey,
  postText,
  withoutHidden,
  type TickerPost,
} from "@/components/Ticker/items"

const cell = {
  borderBottom: "1px solid var(--theme-elevation-200)",
  padding: "0.5rem 0.75rem 0.5rem 0",
  textAlign: "left",
  verticalAlign: "top",
} as const
const muted = { color: "var(--theme-elevation-650)" }
const button = {
  background: "var(--theme-elevation-50)",
  border: "1px solid var(--theme-elevation-300)",
  borderRadius: "4px",
  color: "var(--theme-text)",
  cursor: "pointer",
  font: "inherit",
  padding: "0.25rem 0.75rem",
  whiteSpace: "nowrap",
} as const

const SOURCE_LABELS: Record<TickerPost["source"], string> = { bluesky: "Bluesky", x: "X" }

export type TickerPostStatus = "shown" | "hidden" | "waiting"

const STATUS_LABELS: Record<TickerPostStatus, string> = {
  shown: "On the ticker",
  hidden: "Hidden",
  waiting: "Not shown",
}

/**
 * Every post the sources returned, newest first, and whether the ticker shows it with these
 * links hidden: the newest are shown, and a post older than those, or with the same words as a
 * newer one, waits.
 */
export function tickerPostStatuses(
  lists: TickerPost[][],
  hidden: readonly string[],
): { post: TickerPost; status: TickerPostStatus }[] {
  const hiddenKeys = new Set(hidden.map(postKey).filter(Boolean))
  const shown = new Set(
    mergePosts(lists.map((list) => withoutHidden(list, hidden))).map((post) => post.id),
  )
  return lists
    .flat()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((post) => ({
      post,
      status: hiddenKeys.has(postKey(post.url))
        ? "hidden"
        : shown.has(post.id)
          ? "shown"
          : "waiting",
    }))
}

const posted = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

/**
 * The Ticker global's list of what the sources hold right now, each post with a button that
 * hides it from the ticker or shows it again.
 */
export function TickerPostsTable({
  lists,
  hidden,
  onToggle,
  disabled = false,
}: {
  lists: TickerPost[][]
  /** The links in the global's Hidden posts, saved or not. */
  hidden: readonly string[]
  onToggle: (post: TickerPost, hide: boolean) => void
  disabled?: boolean
}): React.ReactNode {
  const rows = tickerPostStatuses(lists, hidden)
  return (
    <div style={{ marginBottom: "2rem", overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: "0.875rem", width: "100%" }}>
        <caption style={{ marginBottom: "0.5rem", textAlign: "left" }}>
          <div style={{ fontWeight: 600 }}>Posts right now</div>
          <div style={{ ...muted, fontWeight: 400 }}>
            What the accounts under Integrations posted lately. Hide one and save, and it&apos;s
            gone from the ticker.
          </div>
        </caption>
        <thead>
          <tr>
            <th scope="col" style={cell}>
              Post
            </th>
            <th scope="col" style={cell}>
              Status
            </th>
            <th scope="col" style={cell}>
              <span
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                  clip: "rect(0 0 0 0)",
                }}
              >
                Action
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} style={{ ...cell, ...muted }}>
                No posts right now. Integrations shows whether each account is connected here.
              </td>
            </tr>
          )}
          {rows.map(({ post, status }) => {
            const hide = status !== "hidden"
            const text = excerpt(postText(post)) || post.url
            return (
              <tr key={post.id}>
                <td style={cell}>
                  <a href={post.url} target="_blank" rel="noopener noreferrer">
                    {text}
                  </a>
                  <div style={muted}>
                    {SOURCE_LABELS[post.source]} ·{" "}
                    <time dateTime={post.createdAt} suppressHydrationWarning>
                      {posted.format(new Date(post.createdAt))}
                    </time>
                  </div>
                </td>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>
                  <span
                    style={{
                      borderRadius: "4px",
                      display: "inline-block",
                      padding: "0.125rem 0.5rem",
                      ...(status === "shown"
                        ? {
                            background: "var(--theme-success-100)",
                            color: "var(--theme-success-900)",
                          }
                        : status === "hidden"
                          ? {
                              background: "var(--theme-warning-100)",
                              color: "var(--theme-warning-900)",
                            }
                          : {
                              background: "var(--theme-elevation-100)",
                              color: "var(--theme-elevation-800)",
                            }),
                    }}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                </td>
                <td style={{ ...cell, paddingRight: 0, textAlign: "right" }}>
                  <button
                    type="button"
                    style={button}
                    disabled={disabled}
                    aria-label={`${hide ? "Hide" : "Show"}: ${text}`}
                    onClick={() => onToggle(post, hide)}
                  >
                    {hide ? "Hide" : "Show"}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
