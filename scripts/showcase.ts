import "dotenv/config"

import { writeFileSync } from "node:fs"

import { SHOWCASE_LINE } from "./showcase-pr"

import { AUTHOR_ROLES, hasRole } from "@/access/roles"
import type { User } from "@/payload-types"
import { createStockMedia } from "@/endpoints/seed/media"
import { type ShowcaseEntry, showcaseEntries } from "@/endpoints/seed/showcase"
import type { File, Payload } from "payload"

const USAGE = `Usage: pnpm showcase <pr-number | staging | url> (<slug...> | --all) [--draft]

Pushes feature articles from src/endpoints/seed/showcase.ts to a live site
through its REST API, skipping any whose slug is already there. Nothing is
deleted. Logs in as SHOWCASE_EMAIL / SHOWCASE_PASSWORD, an account on that site
that can be credited as author (a preview's users are copied from staging).

  pnpm showcase 748 rich-text-showcase                  → https://pr-748.pragmaticpapers.com
  pnpm showcase staging rich-text-showcase              → SHOWCASE_STAGING_URL, as drafts
  pnpm showcase https://example.com --all --draft

Options:
  --all               push every article in the catalog
  --draft             create the articles as drafts (the default on staging)
  --from-description  read the slugs from a "Showcase:" line in SHOWCASE_DESCRIPTION
                      (a PR description), where "all" means --all; does nothing if
                      there is no such line

With SHOWCASE_LINKS_FILE set, writes a Markdown link to each article it pushed
or found there, titled with its title, one per line, for the PR description's
Showcase: line.`

type Fetch = typeof fetch

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
  file?: File
}

interface Target {
  origin: string
  /** Staging is shared, so its pushes are drafts unless asked otherwise. */
  draftByDefault: boolean
}

/** A PR number maps to its Coolify preview, `staging` to SHOWCASE_STAGING_URL. */
export function resolveTarget(
  target: string,
  env: Record<string, string | undefined> = {},
): Target {
  if (/^\d+$/.test(target)) {
    return { origin: `https://pr-${target}.pragmaticpapers.com`, draftByDefault: false }
  }
  if (target === "staging") {
    const url = env.SHOWCASE_STAGING_URL
    if (!url || !URL.canParse(url)) throw new Error("Set SHOWCASE_STAGING_URL to staging's URL.")
    return { origin: new URL(url).origin, draftByDefault: true }
  }
  if (!URL.canParse(target)) throw new Error(`Not a PR number or URL: ${target}\n\n${USAGE}`)
  return { origin: new URL(target).origin, draftByDefault: false }
}

/** A Markdown link, whose text may escape brackets: `[Title](url)`. */
const MARKDOWN_LINK = /\[(?:\\.|[^\]\\])*\]\(([^)\s]*)\)/g

/** The slug in an article's public URL; an admin URL has none. */
const ARTICLE_PATH = /(?<!collections)\/articles\/([a-z0-9-]+)/

/**
 * Reads the slugs from a PR description's `Showcase:` line, e.g.
 * `Showcase: rich-text-showcase, lorem-ipsum-timeline`. Once pushed, the line
 * links each article by title (see showcaseItem), and a link is read as the
 * slug in its URL. `Showcase: all` (meaning the whole catalog, written by
 * hand) comes back as `["all"]`.
 */
export function slugsFromDescription(description: string): string[] {
  const line = (description.match(SHOWCASE_LINE)?.[1] ?? "").replace(
    MARKDOWN_LINK,
    (_, url: string) => ` ${url.match(ARTICLE_PATH)?.[1] ?? ""} `,
  )
  return line.match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? []
}

/**
 * An article's entry on the `Showcase:` line: a link titled with its title,
 * which slugsFromDescription reads back as its slug. A draft's link goes to
 * the admin, whose URL has no slug, so the slug stays beside it.
 */
export function showcaseItem(slug: string, title: string, url: string): string {
  if (url.match(ARTICLE_PATH)?.[1] !== slug) return `${slug} ([draft](${url}))`
  return `[${title.replace(/[\\[\]]/g, "\\$&")}](${url})`
}

export function selectEntries(
  slugs: string[],
  all = false,
  entries = showcaseEntries,
): ShowcaseEntry[] {
  const known = entries.map((entry) => entry.slug).join("\n  ")
  if (all) return entries
  if (slugs.length === 0) throw new Error(`Name the articles to push, or --all:\n  ${known}`)
  const unknown = slugs.filter((slug) => !entries.some((entry) => entry.slug === slug))
  if (unknown.length > 0) {
    throw new Error(`No showcase entry for ${unknown.join(", ")}. Known:\n  ${known}`)
  }
  return entries.filter((entry) => slugs.includes(entry.slug))
}

async function readJSON(res: Response, action: string): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const errors = (body.errors as { message?: string }[] | undefined)
      ?.map((error) => error.message)
      .join("; ")
    throw new Error(`${action} failed (${res.status}): ${errors || res.statusText}`)
  }
  return body
}

export async function login(
  origin: string,
  email: string,
  password: string,
  fetchImpl: Fetch = fetch,
): Promise<{ token: string; user: User }> {
  const res = await fetchImpl(`${origin}/api/users/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const body = await readJSON(res, `Logging in to ${origin}`)
  return { token: body.token as string, user: body.user as User }
}

/**
 * Stands in for the Local API in seed helpers, which only call `create` and
 * `logger`. Access control and hooks run on the server as for any editor.
 *
 * With `draft`, articles are created as drafts whatever status the seed asks
 * for, so a seed needs no changes to be pushed to staging.
 */
export function createRestPayload(
  origin: string,
  token: string,
  fetchImpl: Fetch = fetch,
  { draft = false } = {},
): Payload {
  const headers = { Authorization: `JWT ${token}` }
  const create = async ({ collection, data: seedData, file }: CreateArgs) => {
    const asDraft = draft && collection === "articles"
    const data = asDraft ? { ...seedData, _status: "draft" } : seedData
    let init: RequestInit
    if (file) {
      const form = new FormData()
      form.append("_payload", JSON.stringify(data))
      form.append("file", new Blob([new Uint8Array(file.data)], { type: file.mimetype }), file.name)
      init = { method: "POST", headers, body: form }
    } else {
      init = {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(data),
      }
    }
    const query = asDraft ? "?depth=0&draft=true" : "?depth=0"
    const res = await fetchImpl(`${origin}/api/${collection}${query}`, init)
    return (await readJSON(res, `Creating ${collection}`)).doc
  }
  const logger = { info: console.warn, warn: console.warn, error: console.error }
  return { create, logger } as unknown as Payload
}

/** The article with the slug, draft or published, if there is one. */
export async function findArticle(
  origin: string,
  token: string,
  slug: string,
  fetchImpl: Fetch = fetch,
): Promise<{ title?: string } | undefined> {
  const query = new URLSearchParams({
    "where[slug][equals]": slug,
    limit: "1",
    depth: "0",
    draft: "true",
  })
  const res = await fetchImpl(`${origin}/api/articles?${query}`, {
    headers: { Authorization: `JWT ${token}` },
  })
  const body = await readJSON(res, `Looking up "${slug}"`)
  return (body.docs as { title?: string }[] | undefined)?.[0]
}

/**
 * Pushes the articles and returns a link to each one (see showcaseItem),
 * whether pushed now or already there.
 */
export async function main(
  argv = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env,
  fetchImpl: Fetch = fetch,
): Promise<string[]> {
  const flags = new Set(argv.filter((arg) => arg.startsWith("-")))
  const [target, ...args] = argv.filter((arg) => !arg.startsWith("-"))
  if (!target || flags.has("--help") || flags.has("-h")) throw new Error(USAGE)
  const unknownFlags = [...flags].filter(
    (flag) => !["--all", "--draft", "--from-description"].includes(flag),
  )
  if (unknownFlags.length > 0)
    throw new Error(`Unknown option ${unknownFlags.join(", ")}\n\n${USAGE}`)

  const { origin, draftByDefault } = resolveTarget(target, env)
  const draft = draftByDefault || flags.has("--draft")
  let slugs = args
  if (flags.has("--from-description")) {
    slugs = slugsFromDescription(env.SHOWCASE_DESCRIPTION ?? "")
    if (slugs.length === 0) {
      console.warn("No Showcase: line in the description; nothing to push.")
      return []
    }
  }
  const entries = selectEntries(slugs, flags.has("--all") || slugs.includes("all"))

  const { SHOWCASE_EMAIL: email, SHOWCASE_PASSWORD: password } = env
  if (!email || !password) {
    throw new Error(`Set SHOWCASE_EMAIL and SHOWCASE_PASSWORD to an account on ${origin}.`)
  }

  const { token, user } = await login(origin, email, password, fetchImpl)
  if (!hasRole(user, AUTHOR_ROLES)) {
    throw new Error(
      `${email} must hold one of ${AUTHOR_ROLES.join(", ")} on ${origin} to be credited as ` +
        `author (has: ${user.roles?.join(", ")}).`,
    )
  }
  const links = new Map<string, string>()
  const pending: ShowcaseEntry[] = []
  for (const entry of entries) {
    const article = await findArticle(origin, token, entry.slug, fetchImpl)
    if (article) {
      const url = `${origin}/articles/${entry.slug}`
      links.set(entry.slug, showcaseItem(entry.slug, article.title || entry.slug, url))
      console.warn(`✔ Already there: ${url}`)
    } else {
      pending.push(entry)
    }
  }
  const list = () => entries.flatMap((entry) => links.get(entry.slug) ?? [])
  if (pending.length === 0) return list()

  const payload = createRestPayload(origin, token, fetchImpl, { draft })
  console.warn(`Uploading stock images to ${origin}…`)
  const media = await createStockMedia(payload)
  for (const entry of pending) {
    console.warn(`Creating ${entry.slug}${draft ? " as a draft" : ""}…`)
    const id = await entry.create(payload, [user], media)
    // A draft has no public page yet, so point at it in the admin.
    const where = draft ? `admin/collections/articles/${id}` : `articles/${entry.slug}`
    const title = (await findArticle(origin, token, entry.slug, fetchImpl))?.title
    links.set(entry.slug, showcaseItem(entry.slug, title || entry.slug, `${origin}/${where}`))
    console.warn(`✔ Pushed${draft ? " as a draft" : ""}: ${origin}/${where}`)
  }
  return list()
}

if (!process.env.VITEST) {
  try {
    const links = await main()
    if (process.env.SHOWCASE_LINKS_FILE) {
      writeFileSync(process.env.SHOWCASE_LINKS_FILE, links.map((link) => `${link}\n`).join(""))
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
