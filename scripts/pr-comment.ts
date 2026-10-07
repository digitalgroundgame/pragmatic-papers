// Creates or updates one comment on a PR, found again by an HTML marker in its body,
// so a report edits its own comment on each push instead of adding another.

export interface PrCommentTarget {
  repo: string
  prNumber: number
  token: string
}

/** The PR a GitHub Actions run belongs to, or null outside a pull_request run. */
export function prCommentTarget(env: NodeJS.ProcessEnv = process.env): PrCommentTarget | null {
  const repo = env.GITHUB_REPOSITORY
  const token = env.GITHUB_TOKEN
  const prNumber = Number(env.PR_NUMBER)
  if (!repo || !token || !Number.isInteger(prNumber) || prNumber <= 0) return null
  return { repo, prNumber, token }
}

export async function upsertPrComment(
  { repo, prNumber, token }: PrCommentTarget,
  marker: string,
  body: string,
): Promise<void> {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "pragmatic-papers-ci",
  }
  const tag = `<!-- ${marker} -->`
  let existing: { id: number } | undefined
  for (let page = 1; !existing; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100&page=${page}`,
      { headers },
    )
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
    const comments = (await res.json()) as { id: number; body?: string }[]
    existing = comments.find((comment) => comment.body?.includes(tag))
    if (comments.length < 100) break
  }
  const url = existing
    ? `https://api.github.com/repos/${repo}/issues/comments/${existing.id}`
    : `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`
  const res = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ body: `${tag}\n${body}` }),
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
}
