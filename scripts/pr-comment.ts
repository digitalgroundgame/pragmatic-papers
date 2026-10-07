// CI's reports share one comment on a PR: code coverage (scripts/coverage-report.ts),
// then bundle size (scripts/bundle-size.ts) and Lighthouse (scripts/lighthouse.ts) as
// dropdowns under it. Each job owns one section of that comment, between
// `<!-- section:<name> -->` markers, and replaces only its own, so a push edits the
// comment rather than adding another and a job that didn't run leaves its last
// section in place.
//
// The jobs finish independently, in two workflows, and GitHub has no conditional
// write for comments: two jobs that read the comment at the same moment would each
// write it back without the other's section. So after writing, a job waits, reads the
// comment again and, if its section isn't there as written, writes it again. Two jobs
// that each create the comment at once keep the older one: the other job moves its
// section there and deletes the copy it made.

export interface PrCommentTarget {
  repo: string
  prNumber: number
  token: string
}

/** The marker that finds the shared comment. It was the coverage comment's alone. */
export const REPORT_MARKER = "<!-- coverage-report -->"
/** The order sections appear in, top to bottom; a name not listed goes last. */
const SECTION_ORDER = ["coverage", "bundle-size", "lighthouse"]
const ATTEMPTS = 4

interface Comment {
  id: number
  body?: string
}

/** The PR a GitHub Actions run belongs to, or null outside a pull_request run. */
export function prCommentTarget(env: NodeJS.ProcessEnv = process.env): PrCommentTarget | null {
  const repo = env.GITHUB_REPOSITORY
  const token = env.GITHUB_TOKEN
  const prNumber = Number(env.PR_NUMBER)
  if (!repo || !token || !Number.isInteger(prNumber) || prNumber <= 0) return null
  return { repo, prNumber, token }
}

/**
 * A report as a dropdown: `summary` (plain text: GitHub doesn't render Markdown in a
 * `<summary>`) is the line that shows while it's closed. A report with a warning
 * starts open.
 */
export function collapsible({
  title,
  summary,
  body,
  open,
}: {
  title: string
  summary: string
  body: string
  open: boolean
}): string {
  return [
    `<details${open ? " open" : ""}><summary><strong>${title}</strong>: ${summary}</summary>`,
    "",
    body,
    "",
    "</details>",
  ].join("\n")
}

const sectionPattern = (name?: string) =>
  new RegExp(`<!-- section:(${name ?? "[\\w-]+"}) -->\\n([\\s\\S]*?)\\n<!-- /section:\\1 -->`, "g")

function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n").trim()
}

/** Every section in a comment body, by name. Text outside the markers is dropped. */
export function readSections(body: string | undefined): Map<string, string> {
  const sections = new Map<string, string>()
  for (const [, name, content] of normalize(body ?? "").matchAll(sectionPattern())) {
    sections.set(name!, content!)
  }
  return sections
}

/** `body` with section `name` set to `content`, every section in SECTION_ORDER. */
export function withSection(body: string | undefined, name: string, content: string): string {
  const sections = readSections(body)
  sections.set(name, normalize(content))
  const rank = (section: string) => {
    const index = SECTION_ORDER.indexOf(section)
    return index === -1 ? SECTION_ORDER.length : index
  }
  const ordered = [...sections].sort(([a], [z]) => rank(a) - rank(z))
  return [
    REPORT_MARKER,
    ...ordered.map(
      ([section, text]) => `<!-- section:${section} -->\n${text}\n<!-- /section:${section} -->`,
    ),
  ].join("\n\n")
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Sets this job's section of the shared report comment, creating the comment if the PR
 * has none. Comments carrying any of `staleMarkers` (an older, separate comment for the
 * same report) are deleted.
 */
export async function upsertPrCommentSection(
  { repo, prNumber, token }: PrCommentTarget,
  name: string,
  content: string,
  {
    staleMarkers = [],
    sleep = defaultSleep,
  }: { staleMarkers?: string[]; sleep?: (ms: number) => Promise<void> } = {},
): Promise<void> {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "pragmatic-papers-ci",
  }
  const api = async (url: string, init: RequestInit = {}) => {
    const res = await fetch(`https://api.github.com/repos/${repo}${url}`, {
      ...init,
      headers: { ...headers, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    })
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
    return res
  }
  const listComments = async () => {
    const all: Comment[] = []
    for (let page = 1; ; page++) {
      const res = await api(`/issues/${prNumber}/comments?per_page=100&page=${page}`)
      const comments = (await res.json()) as Comment[]
      all.push(...comments)
      if (comments.length < 100) return all
    }
  }
  /** The oldest comment carrying the marker: the one every job writes to. */
  const canonical = (comments: Comment[]) =>
    comments
      .filter((comment) => comment.body?.includes(REPORT_MARKER))
      .sort((a, z) => a.id - z.id)[0]

  let comments = await listComments()
  for (const comment of comments) {
    if (!staleMarkers.some((marker) => comment.body?.includes(marker))) continue
    try {
      await api(`/issues/comments/${comment.id}`, { method: "DELETE" })
    } catch (err) {
      console.warn(`Could not delete the old comment ${comment.id}: ${(err as Error).message}`)
    }
  }

  const wanted = normalize(content)
  let created: number | undefined
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const existing = canonical(comments)
    if (existing) {
      await api(`/issues/comments/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ body: withSection(existing.body, name, wanted) }),
      })
      if (created !== undefined && created !== existing.id) {
        await api(`/issues/comments/${created}`, { method: "DELETE" })
        created = undefined
      }
    } else {
      const res = await api(`/issues/${prNumber}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: withSection(undefined, name, wanted) }),
      })
      created = ((await res.json()) as Comment).id
    }

    // Long enough for another job's read-then-write to land, staggered so two jobs
    // that collided don't collide again.
    await sleep(3000 + Math.random() * 4000)
    comments = await listComments()
    if (readSections(canonical(comments)?.body).get(name) === wanted) return
  }
  throw new Error(`another job kept overwriting the ${name} section`)
}
