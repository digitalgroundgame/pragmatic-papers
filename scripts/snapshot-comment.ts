// Renders the "Snapshot updates in this PR" comment body as a 2-column HTML
// table grid. Invoked from .github/workflows/playwright.yml. Pure function:
// reads FINGERPRINT and ASSET_BASE_URL from env, changed PNG paths from stdin
// (one per line), and writes the full comment body to stdout.

import { basename } from "node:path"

const COLUMNS = 2

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const c of process.stdin) chunks.push(c as Buffer)
  return Buffer.concat(chunks).toString("utf8")
}

const fingerprint = process.env.FINGERPRINT ?? ""
const baseUrl = (process.env.ASSET_BASE_URL ?? "").replace(/\/$/, "")

const changed = (await readStdin())
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean)

const cells = changed.map((src) => {
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

process.stdout.write(
  `<!-- screenshots:${fingerprint} -->\n` +
    `## Snapshot updates in this PR\n` +
    `<table>${rows.join("")}</table>\n`,
)
