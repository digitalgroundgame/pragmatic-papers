import "dotenv/config"

import { AUTHOR_ROLES, hasRole, isEditor } from "@/access/roles"
import type { User } from "@/payload-types"
import { createStockMedia } from "@/endpoints/seed/media"
import { type ShowcaseEntry, showcaseEntries } from "@/endpoints/seed/showcase"
import type { File, Payload } from "payload"

const USAGE = `Usage: pnpm showcase <pr-number | url> [slug...]

Pushes the showcase articles in src/endpoints/seed/showcase.ts to a live site
through its REST API, skipping any whose slug is already there. Nothing is
deleted. Logs in as SHOWCASE_EMAIL / SHOWCASE_PASSWORD (an editor account on
that site; a preview's database is copied from staging).

  pnpm showcase 748                          → https://pr-748.pragmaticpapers.com
  pnpm showcase https://staging.example.com
  pnpm showcase 748 finding-your-way-table-of-contents`

type Fetch = typeof fetch

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
  file?: File
}

/** A PR number maps to its Coolify preview; anything else must be a URL. */
export function resolveTarget(target: string): string {
  if (/^\d+$/.test(target)) return `https://pr-${target}.pragmaticpapers.com`
  if (!URL.canParse(target)) throw new Error(`Not a PR number or URL: ${target}\n\n${USAGE}`)
  return new URL(target).origin
}

export function selectEntries(slugs: string[], entries = showcaseEntries): ShowcaseEntry[] {
  if (slugs.length === 0) return entries
  const unknown = slugs.filter((slug) => !entries.some((entry) => entry.slug === slug))
  if (unknown.length > 0) {
    const known = entries.map((entry) => entry.slug).join(", ")
    throw new Error(`No showcase entry for ${unknown.join(", ")}. Known: ${known}`)
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
 */
export function createRestPayload(
  origin: string,
  token: string,
  fetchImpl: Fetch = fetch,
): Payload {
  const headers = { Authorization: `JWT ${token}` }
  const create = async ({ collection, data, file }: CreateArgs) => {
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
    const res = await fetchImpl(`${origin}/api/${collection}?depth=0`, init)
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
  const [target, ...slugs] = argv
  if (!target || target === "--help" || target === "-h") throw new Error(USAGE)

  const origin = resolveTarget(target)
  const entries = selectEntries(slugs)
  const { SHOWCASE_EMAIL: email, SHOWCASE_PASSWORD: password } = env
  if (!email || !password) {
    throw new Error(`Set SHOWCASE_EMAIL and SHOWCASE_PASSWORD to an editor on ${origin}.`)
  }

  const { token, user } = await login(origin, email, password, fetchImpl)
  if (!isEditor(user) || !hasRole(user, AUTHOR_ROLES)) {
    throw new Error(
      `${email} must be an editor on ${origin} to publish, and hold one of ` +
        `${AUTHOR_ROLES.join(", ")} to be credited as author (has: ${user.roles?.join(", ")}).`,
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

  const payload = createRestPayload(origin, token, fetchImpl)
  console.warn(`Uploading stock images to ${origin}…`)
  const media = await createStockMedia(payload)
  for (const entry of pending) {
    console.warn(`Creating ${entry.slug}…`)
    await entry.create(payload, [user], media)
    console.warn(`✔ Pushed: ${origin}/articles/${entry.slug}`)
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
