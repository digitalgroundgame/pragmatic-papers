import { createHash } from "node:crypto"

import type { Payload } from "payload"

import { DOCS_SLUG } from "./collection"

/**
 * The repo's copy of a doc a site last took in, kept in Payload's key-value store: the Markdown
 * and a hash of each file it uses. A doc the site has is never changed by a deploy, so this is
 * what the repo's later changes to it are measured against, however many releases that spans.
 */
export interface DocBaseline {
  hash: string
  source: string
  /** Each file the doc uses, by its name beside the doc, as a sha256. */
  files: Record<string, string>
}

const baselineKey = (slug: string): string => `doc-source:${DOCS_SLUG}:${slug}`

export const readBaseline = (payload: Payload, slug: string): Promise<DocBaseline | null> =>
  payload.kv.get<DocBaseline>(baselineKey(slug))

export const saveBaseline = (
  payload: Payload,
  slug: string,
  baseline: DocBaseline,
): Promise<void> => payload.kv.set(baselineKey(slug), baseline)

export const hashFile = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex")
