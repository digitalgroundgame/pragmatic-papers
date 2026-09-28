// Renders a screenshot-grid PR comment body as an HTML table. Invoked from
// .github/workflows/playwright.yml for two comment flavors: "Snapshot updates
// in this PR" (default) and "Visual regressions detected" (via MARKER/TITLE/
// COLUMNS/FOOTER env overrides). Pure function: reads FINGERPRINT and
// ASSET_BASE_URL from env, PNG paths from stdin (one per line), and writes the
// full comment body to stdout.

import { basename } from "node:path"

export async function readStdin(stream: NodeJS.ReadableStream = process.stdin): Promise<string> {
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c as Buffer)
  return Buffer.concat(chunks).toString("utf8")
}

export function buildCommentBody(opts: {
  fingerprint: string
  baseUrl: string
  paths: string[]
  marker?: string
  title?: string
  columns?: number
  footer?: string
}): string {
  const { fingerprint, paths } = opts
  const marker = opts.marker ?? "screenshots"
  const title = opts.title ?? "Snapshot updates in this PR"
  const columns = opts.columns ?? 2
  const baseUrl = opts.baseUrl.replace(/\/$/, "")
  const width = `${Math.floor(100 / columns)}%`

  const cells = paths.map((src) => {
    const name = basename(src, ".png")
    const url = `${baseUrl}/${name}.png`
    return `<td width="${width}" valign="top"><img src="${url}" alt="${name}" width="100%"/></td>`
  })

  const rows: string[] = []
  for (let i = 0; i < cells.length; i += columns) {
    const row = cells.slice(i, i + columns)
    while (row.length < columns) row.push("<td></td>")
    rows.push(`<tr>${row.join("")}</tr>`)
  }

  return (
    `<!-- ${marker}:${fingerprint} -->\n` +
    `## ${title}\n` +
    `<table>${rows.join("")}</table>\n` +
    (opts.footer ? `\n${opts.footer}\n` : "")
  )
}

export async function main(readInput: () => Promise<string> = readStdin): Promise<void> {
  const fingerprint = process.env.FINGERPRINT ?? ""
  const baseUrl = process.env.ASSET_BASE_URL ?? ""
  const columnsEnv = Number(process.env.COLUMNS_PER_ROW)
  const paths = (await readInput())
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  process.stdout.write(
    buildCommentBody({
      fingerprint,
      baseUrl,
      paths,
      marker: process.env.MARKER || undefined,
      title: process.env.TITLE || undefined,
      columns: Number.isFinite(columnsEnv) && columnsEnv > 0 ? columnsEnv : undefined,
      footer: process.env.FOOTER || undefined,
    }),
  )
}

// CLI entry point — only runs when executed directly, not when imported.
/* v8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  await main()
}
