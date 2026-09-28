import "dotenv/config"

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
                      there is no such line`

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

/**
 * Reads the slugs from a PR description's `Showcase:` line, e.g.
 * `Showcase: rich-text-showcase, lorem-ipsum-timeline`. `Showcase: all` (what
 * the showcase label inserts) comes back as `["all"]`.
 */
export function slugsFromDescription(description: string): string[] {
  const line = description.match(/^[\s>*_-]*showcase\s*:[*_\s]*(.*)$/im)?.[1] ?? ""
  return line.match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? []
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

export async function articleExists(
  origin: string,
  token: string,
  slug: string,
  fetchImpl: Fetch = fetch,
): Promise<boolean> {
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
  return (body.totalDocs as number) > 0
}

export async function main(
  argv = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env,
  fetchImpl: Fetch = fetch,
): Promise<void> {
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
      return
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
  const pending: ShowcaseEntry[] = []
  for (const entry of entries) {
    if (await articleExists(origin, token, entry.slug, fetchImpl)) {
      console.warn(`✔ Already there: ${origin}/articles/${entry.slug}`)
    } else {
      pending.push(entry)
    }
  }
  if (pending.length === 0) return

  const payload = createRestPayload(origin, token, fetchImpl, { draft })
  console.warn(`Uploading stock images to ${origin}…`)
  const media = await createStockMedia(payload)
  for (const entry of pending) {
    console.warn(`Creating ${entry.slug}${draft ? " as a draft" : ""}…`)
    const id = await entry.create(payload, [user], media)
    // A draft has no public page yet, so point at it in the admin.
    const where = draft ? `admin/collections/articles/${id}` : `articles/${entry.slug}`
    console.warn(`✔ Pushed${draft ? " as a draft" : ""}: ${origin}/${where}`)
  }
}

if (!process.env.VITEST) {
  try {
    await main()
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
