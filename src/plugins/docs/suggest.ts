import { createHash } from "node:crypto"

import { structuredPatch } from "diff"
import type { Payload } from "payload"

import { DOCS_SLUG } from "./collection"
import { parseDocFile } from "./docFile"
import { DOC_SUGGESTIONS_SLUG } from "./suggestionsCollection"

/**
 * The repo's copy of a doc a site last took in, kept in Payload's key-value store: the Markdown
 * and a hash of each file it uses. The next change to the doc is diffed against it, so each site
 * is shown what changed since it last saw the doc, however many releases that spans.
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

/**
 * A doc's Markdown without its `changeNote`, which describes the change rather than being part
 * of it, so a new note doesn't show up in the diff.
 */
export const withoutChangeNote = (source: string): string =>
  source.replace(/^(---\r?\n[\s\S]*?)^changeNote:.*\r?\n/m, "$1")

/**
 * The lines that changed between two copies of a doc's Markdown, as a unified diff's hunks
 * (`@@ -3,2 +3,3 @@`, then lines starting with a space, `-` or `+`); empty when nothing did.
 */
export function diffDocSource(from: string, to: string): string {
  const { hunks } = structuredPatch(
    "",
    "",
    withoutChangeNote(from),
    withoutChangeNote(to),
    "",
    "",
    { context: 3 },
  )
  return hunks
    .map(
      (hunk) =>
        `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n${hunk.lines.join("\n")}`,
    )
    .join("\n")
}

/** The files the new copy uses that the old one didn't, or whose content changed. */
export const changedFiles = (
  before: Record<string, string> | undefined,
  after: Record<string, string>,
): string[] => Object.keys(after).filter((name) => before?.[name] !== after[name])

/**
 * The PR's note on what changed, from the new copy's `changeNote`, or null when it has none or
 * it's the note the site already saw (a PR that changed the doc but forgot to update it).
 */
export function newChangeNote(from: string | null, to: string): string | null {
  const note = (source: string) => {
    try {
      return parseDocFile(source, "doc").meta.changeNote?.trim() || null
    } catch {
      return null
    }
  }
  const next = note(to)
  return next && next !== (from === null ? null : note(from)) ? next : null
}

/** Said in place of a diff when the site never kept a copy of the doc to compare with. */
export const NO_BASELINE_NOTE =
  "This site has no earlier copy of the repo's doc to compare with, so the changes show all of it."

export interface SuggestChange {
  /** The site's doc. */
  doc: number | string
  title: string
  /** The copy the site last took in, or null when it never kept one. */
  from: DocBaseline | null
  to: DocBaseline
  /** Media uploaded for the files that are new or changed. */
  pictures: (number | string)[]
}

/**
 * Tells editors that the repo changed a doc, without touching the doc: a suggestion beside it
 * holds what changed in the Markdown, the PR's note and any new pictures, for an editor to work
 * into the doc in their own words and then resolve. A doc has at most one open suggestion: a
 * change arriving while one is still open joins it, its diff running from the copy the open one
 * started at, so editors read one combined change.
 */
export async function suggestChange(
  payload: Payload,
  { doc, title, from, to, pictures }: SuggestChange,
): Promise<"created" | "updated"> {
  const { docs } = await payload.find({
    collection: DOC_SUGGESTIONS_SLUG,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    sort: "-createdAt",
    where: { and: [{ doc: { equals: doc } }, { status: { equals: "open" } }] },
  })
  const open = docs[0]
  const note = newChangeNote(from?.source ?? null, to.source)
  const context = { disableRevalidate: true }

  if (open) {
    const start = open.fromSource ?? null
    const notes = [open.note, note].filter((text): text is string => Boolean(text?.trim()))
    await payload.update({
      collection: DOC_SUGGESTIONS_SLUG,
      id: open.id,
      context,
      overrideAccess: true,
      data: {
        title,
        note: notes.join("\n\n") || null,
        changes: diffDocSource(start ?? "", to.source),
        toSource: to.source,
        toHash: to.hash,
        pictures: [
          ...new Set([
            ...(open.pictures ?? []).map((item) => (typeof item === "object" ? item.id : item)),
            ...pictures,
          ]),
        ] as number[],
      },
    })
    return "updated"
  }

  await payload.create({
    collection: DOC_SUGGESTIONS_SLUG,
    context,
    overrideAccess: true,
    data: {
      doc: doc as number,
      title,
      status: "open",
      note: [from ? null : NO_BASELINE_NOTE, note].filter(Boolean).join("\n\n") || null,
      changes: diffDocSource(from?.source ?? "", to.source),
      fromSource: from?.source ?? null,
      toSource: to.source,
      fromHash: from?.hash ?? null,
      toHash: to.hash,
      pictures: pictures as number[],
    },
  })
  return "created"
}
