// Renders the "Snapshot updates in this PR" comment body as a 2-column HTML
// table grid. Invoked from .github/workflows/playwright.yml. Pure function:
// reads FINGERPRINT and ASSET_BASE_URL from env, changed PNG paths from stdin
// (one per line), and writes the full comment body to stdout.

import { basename } from "node:path"

const COLUMNS = 2

export async function readStdin(stream: NodeJS.ReadableStream = process.stdin): Promise<string> {
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c as Buffer)
  return Buffer.concat(chunks).toString("utf8")
}

export function buildCommentBody(opts: {
  fingerprint: string
  baseUrl: string
  paths: string[]
}): string {
  const { fingerprint, paths } = opts
  const baseUrl = opts.baseUrl.replace(/\/$/, "")

  const cells = paths.map((src) => {
    const name = basename(src, ".png")
    const url = `${baseUrl}/${name}.png`
    return `<td width="50%" valign="top"><img src="${url}" alt="${name}" width="100%"/></td>`
  })

  const rows: string[] = []
  for (let i = 0; i < cells.length; i += COLUMNS) {
    const row = cells.slice(i, i + COLUMNS)
    while (row.length < COLUMNS) row.push("<td></td>")
    rows.push(`<tr>${row.join("")}</tr>`)
  }

  return (
    `<!-- screenshots:${fingerprint} -->\n` +
    `## Snapshot updates in this PR\n` +
    `<table>${rows.join("")}</table>\n`
  )
}

export async function main(readInput: () => Promise<string> = readStdin): Promise<void> {
  const fingerprint = process.env.FINGERPRINT ?? ""
  const baseUrl = process.env.ASSET_BASE_URL ?? ""
  const paths = (await readInput())
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  process.stdout.write(buildCommentBody({ fingerprint, baseUrl, paths }))
}

// CLI entry point — only runs when executed directly, not when imported.
/* v8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  await main()
}
