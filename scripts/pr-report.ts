// CI's PR analytics share one comment on a PR. Each report registers a section in
// PR_REPORT_SECTIONS below and posts it with postPrReportSection(); the comment shows
// the sections in the order they're registered. A job replaces only its own section,
// between `<!-- section:<name> -->` markers, so a push edits the comment rather than
// adding another, and a job that didn't run leaves its last section in place. A
// section that's no longer registered is dropped the next time any job writes.
//
// The jobs finish independently, in two workflows, and GitHub has no conditional
// write for comments: two jobs that read the comment at the same moment would each
// write it back without the other's section. So after writing, a job waits, reads the
// comment again and, if its section isn't there as written, writes it again. Two jobs
// that each create the comment at once keep the older one: the other job moves its
// section there and deletes the copy it made.
//
// The comment is linked as "Coverage" on the links line at the top of the PR's
// description (setPrLink in scripts/preview-deployment.ts).

import { commentLink, setPrLink } from "./preview-deployment"

/**
 * Every report in the PR analytics comment, top to bottom. `replaces` lists the
 * markers of the separate comment a report used to post, deleted when it next posts.
 */
export const PR_REPORT_SECTIONS = {
  /** scripts/coverage-report.ts */
  coverage: { replaces: ["<!-- vitest-coverage-report-marker-root -->"] },
  /** scripts/bundle-size.ts */
  "bundle-size": { replaces: ["<!-- bundle-size -->"] },
  /** scripts/lighthouse.ts */
  lighthouse: { replaces: ["<!-- lighthouse -->"] },
} satisfies Record<string, { replaces: string[] }>

export type PrReportSection = keyof typeof PR_REPORT_SECTIONS

export interface PrCommentTarget {
  repo: string
  prNumber: number
  token: string
}

/** The marker that finds the shared comment. It was the coverage comment's alone. */
export const REPORT_MARKER = "<!-- coverage-report -->"
const SECTION_ORDER = Object.keys(PR_REPORT_SECTIONS) as PrReportSection[]
const ATTEMPTS = 4

interface Comment {
  id: number
  body?: string
  user?: { type?: string } | null
}

/**
 * Whether CI wrote this comment, opening with `marker`. Only those are ours to edit or
 * delete: a person quoting a marker in a comment (a review, say) must keep their comment.
 */
const postedByCI = (comment: Comment, marker: string) =>
  comment.user?.type === "Bot" && (comment.body ?? "").trimStart().startsWith(marker)

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

const isSection = (name: string): name is PrReportSection => name in PR_REPORT_SECTIONS

/**
 * Every registered section in a comment body, by name. Text outside the markers, and
 * sections no longer registered, are dropped.
 */
export function readSections(body: string | undefined): Map<PrReportSection, string> {
  const sections = new Map<PrReportSection, string>()
  for (const [, name, content] of normalize(body ?? "").matchAll(sectionPattern())) {
    if (isSection(name!)) sections.set(name, content!)
  }
  return sections
}

/** `body` with section `name` set to `content`, every section in registered order. */
export function withSection(
  body: string | undefined,
  name: PrReportSection,
  content: string,
): string {
  const sections = readSections(body)
  sections.set(name, normalize(content))
  return [
    REPORT_MARKER,
    ...SECTION_ORDER.filter((section) => sections.has(section)).map(
      (section) =>
        `<!-- section:${section} -->\n${sections.get(section)}\n<!-- /section:${section} -->`,
    ),
  ].join("\n\n")
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Sets a report's section of the PR analytics comment, creating the comment if the PR
 * has none, and deletes the separate comment the report used to post.
 */
export async function postPrReportSection(
  { repo, prNumber, token }: PrCommentTarget,
  name: PrReportSection,
  content: string,
  { sleep = defaultSleep }: { sleep?: (ms: number) => Promise<void> } = {},
): Promise<void> {
  const staleMarkers: readonly string[] = PR_REPORT_SECTIONS[name].replaces
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
    comments.filter((comment) => postedByCI(comment, REPORT_MARKER)).sort((a, z) => a.id - z.id)[0]

  let comments = await listComments()
  for (const comment of comments) {
    if (!staleMarkers.some((marker) => postedByCI(comment, marker))) continue
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
    const current = canonical(comments)
    if (readSections(current?.body).get(name) === wanted) {
      const link = commentLink("Coverage", repo, prNumber, current!.id)
      await setPrLink({ repo, prNumber, token }, "Coverage", link, {
        fetch: (...args) => fetch(...args),
        log: (message) => console.warn(message),
        sleep,
      })
      return
    }
  }
  throw new Error(`another job kept overwriting the ${name} section`)
}
