/**
 * The blocks CI keeps at the top of a PR's description, shared by every job that
 * writes one. Each block sits between its own `<!-- name -->` and `<!-- /name -->`
 * markers, and its job only ever replaces what's between them. Top to bottom:
 *
 *   showcase-links   scripts/showcase-pr.ts: the showcase articles on the preview
 *   pr-links         one line of links, each set by its own job with setPrLink:
 *                    Preview (scripts/preview-deployment.ts) and Coverage
 *                    (scripts/pr-report.ts)
 *   storybook-links  scripts/storybook-pr.ts: the components the PR changes
 *
 * A new block goes under the blocks above it in BLOCKS, else at the very top, under
 * any `Closes #N` lines. The links line drops its Preview link while there are
 * showcase links, which go to the same site.
 *
 * GitHub has no conditional write and no way to edit part of a description, so
 * two jobs that read it at once each write back the other's old text. editPrBody
 * reads the description back after writing and writes again if another job's write
 * replaced this one. Edits made with the workflow's token start no workflow, so
 * none of this can loop. Runs under plain Node 24, so the scripts importing it
 * (and their workflows' sparse checkouts) name it with its `.ts` extension.
 */

/** CI's blocks, top to bottom. */
export const BLOCKS = ["showcase-links", "pr-links", "storybook-links"] as const
export type BlockName = (typeof BLOCKS)[number]

export const blockStart = (name: BlockName): string => `<!-- ${name} -->`
export const blockEnd = (name: BlockName): string => `<!-- /${name} -->`

const blockPattern = (name: BlockName): RegExp =>
  new RegExp(`${blockStart(name)}\\n?([\\s\\S]*?)\\n?${blockEnd(name)}`)

/** The block's markers around `content`. */
export function renderBlock(name: BlockName, content: string): string {
  return `${blockStart(name)}\n${content}\n${blockEnd(name)}`
}

/** What's between the block's markers, or undefined when there's no block. */
export function blockContent(body: string, name: BlockName): string | undefined {
  return blockPattern(name).exec(body)?.[1]
}

/**
 * A line linking an issue the PR closes, such as `Closes #743`, or the template's
 * `Closes #` left unfilled, so blocks go under it rather than above it.
 */
const CLOSING_LINE = /^\s*(close[sd]?|fix(e[sd])?|resolve[sd]?):?\s+([\w.-]+\/[\w.-]+)?#(\d+|\s*$)/i

/** Puts `block` at the top of the description, under any `Closes #N` lines. */
export function atTop(body: string, block: string): string {
  const lines = body.split("\n")
  let top = 0
  for (let i = 0; i < lines.length; i++) {
    if (CLOSING_LINE.test(lines[i]!)) top = i + 1
    else if (lines[i]!.trim()) break
  }
  const head = lines.slice(0, top).join("\n").trimEnd()
  const rest = lines.slice(top).join("\n").trimStart()
  return [head, block, rest].filter(Boolean).join("\n\n") + (rest ? "" : "\n")
}

/**
 * Sets the `name` block to `block` (rendered with renderBlock), in place if there
 * is one, else under the blocks above it, else at the top. Null removes it.
 */
export function withBlock(body: string, name: BlockName, block: string | null): string {
  const match = blockPattern(name).exec(body)
  if (match && block) return body.replace(match[0], () => block)
  if (match) {
    const before = body.slice(0, match.index).trimEnd()
    const after = body.slice(match.index + match[0].length).trimStart()
    return before && after ? `${before}\n\n${after}` : before || after
  }
  if (!block) return body
  for (const above of BLOCKS.slice(0, BLOCKS.indexOf(name)).reverse()) {
    const end = body.indexOf(blockEnd(above))
    if (end < 0) continue
    const cut = end + blockEnd(above).length
    const rest = body.slice(cut).trimStart()
    return `${body.slice(0, cut)}\n\n${block}${rest ? `\n\n${rest}` : "\n"}`
  }
  return atTop(body, block)
}

/** The links line's links, left to right. Each starts `[Label](`. */
export const LINK_LABELS = ["Preview", "Coverage"] as const
export type LinkLabel = (typeof LINK_LABELS)[number]
const SEPARATOR = " · "

/** A link to a comment on the PR. */
export function commentLink(label: LinkLabel, repo: string, pr: number, id: number): string {
  return `[${label}](https://github.com/${repo}/pull/${pr}#issuecomment-${id})`
}

/**
 * Sets the links line's `label` link (null removes it), keeping the others. The
 * line loses its Preview link while there are showcase links, and goes when it has
 * no links.
 */
export function withPrLink(body: string, label: LinkLabel, link: string | null): string {
  const links = new Map<string, string>()
  for (const item of blockContent(body, "pr-links")?.split(SEPARATOR) ?? []) {
    const name = /^\[([^\]]+)\]\(/.exec(item.trim())?.[1]
    if (name) links.set(name, item.trim())
  }
  if (link) links.set(label, link)
  else links.delete(label)
  if (body.includes(blockEnd("showcase-links"))) links.delete("Preview")
  const items = LINK_LABELS.flatMap((name) => links.get(name) ?? [])
  return withBlock(
    body,
    "pr-links",
    items.length ? renderBlock("pr-links", items.join(SEPARATOR)) : null,
  )
}

export interface PrTarget {
  repo: string
  prNumber: number
  token: string
}

export interface EditDeps {
  fetch: typeof fetch
  log: (message: string) => void
  sleep: (ms: number) => Promise<void>
}

const defaultDeps: EditDeps = {
  fetch: (...args) => fetch(...args),
  log: (message) => process.stdout.write(`${message}\n`),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}

/** Writes before giving up on a description other jobs keep rewriting. */
const ATTEMPTS = 3

/**
 * Applies `edit` to the PR's description until it reads back with the edit made
 * (see the top of this file). Returns the description as last read, or null after
 * a warning naming `what` when GitHub refused or other jobs kept rewriting it: CI's
 * blocks are a convenience, never a reason to fail a job.
 */
export async function editPrBody(
  { repo, prNumber, token }: PrTarget,
  edit: (body: string) => string,
  what: string,
  deps: EditDeps = defaultDeps,
): Promise<string | null> {
  const url = `https://api.github.com/repos/${repo}/pulls/${prNumber}`
  const call = async (method: string, body?: string): Promise<string> => {
    const res = await deps.fetch(url, {
      method,
      body,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body && { "Content-Type": "application/json" }),
      },
    })
    if (!res.ok)
      throw new Error(`${method} ${url} → ${res.status}: ${(await res.text()).slice(0, 500)}`)
    return ((await res.json()) as { body: string | null }).body ?? ""
  }
  try {
    let body = await call("GET")
    for (let attempt = 1; edit(body) !== body; attempt++) {
      if (attempt > ATTEMPTS) {
        deps.log(`::warning::Other jobs kept rewriting the PR's description; ${what} not updated.`)
        return null
      }
      await call("PATCH", JSON.stringify({ body: edit(body) }))
      // Long enough for another job's read-then-write to land, staggered so two
      // jobs that collided don't collide again.
      await deps.sleep(2000 + Math.random() * 3000)
      body = await call("GET")
    }
    return body
  } catch (err) {
    deps.log(
      `::warning::Couldn't update the ${what} in the PR's description: ${(err as Error).message}`,
    )
    return null
  }
}

/** Sets the links line's `label` link (null removes it); see editPrBody. */
export async function setPrLink(
  target: PrTarget,
  label: LinkLabel,
  link: string | null,
  deps: EditDeps = defaultDeps,
): Promise<void> {
  const edited = editPrBody(target, (body) => withPrLink(body, label, link), `${label} link`, deps)
  if ((await edited) !== null)
    deps.log(`${link ? "Set" : "Removed"} the ${label} link in the PR's description.`)
}
