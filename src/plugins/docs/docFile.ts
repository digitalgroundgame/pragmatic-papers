import { type Role, STAFF_ROLES } from "@/access/roles"

/**
 * A doc's file in the repo, `src/docs/<section>/<slug>.md`: front matter between `---` lines,
 * then the body in Markdown. Only a flat subset of YAML is read (one `key: value` per line, a
 * string optionally in JSON quotes, `[a, b]` for a list), so GitHub still shows it as a table.
 */
export interface DocFrontMatter {
  title: string
  /** A short name for the docs sidebar; the title when left out. */
  navTitle?: string
  summary: string
  /** `YYYY-MM-DD`. */
  publishedAt: string
  /** `YYYY-MM-DD`: when it last changed in a way readers should know about, shown beside its date. */
  revisedAt?: string
  /** A file beside the doc, `<slug>-hero.webp` by convention: the bell's thumbnail and the link preview's image. */
  heroImage: string
  heroAlt: string
  audience?: Role[]
  /** Left out means shown. */
  showTableOfContents?: boolean
}

export interface DocFile {
  meta: DocFrontMatter
  body: string
}

const KEYS = [
  "title",
  "navTitle",
  "summary",
  "publishedAt",
  "revisedAt",
  "heroImage",
  "heroAlt",
  "audience",
  "showTableOfContents",
] as const satisfies (keyof DocFrontMatter)[]

const REQUIRED = ["title", "summary", "publishedAt", "heroImage", "heroAlt"] as const

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** A picture on a line of its own: `![alt](file)`, the file beside the doc. */
export const IMAGE_LINE = /^!\[((?:[^\]\\]|\\.)*)\]\(([^)\s]+)\)[ \t]*$/

export interface ImageLine {
  alt: string
  file: string
}

export const parseImageLine = (line: string): ImageLine | null => {
  const match = IMAGE_LINE.exec(line)
  return match ? { alt: match[1]!.replace(/\\(.)/g, "$1"), file: match[2]! } : null
}

export const formatImageLine = ({ alt, file }: ImageLine): string =>
  `![${alt.replace(/[\\\]]/g, "\\$&")}](${file})`

/** Every picture the body shows on a line of its own. */
export const imagesIn = (body: string): ImageLine[] =>
  body.split("\n").flatMap((line) => parseImageLine(line) ?? [])

const parseValue = (raw: string): unknown => {
  if (raw.startsWith('"')) return JSON.parse(raw) as string
  if (raw === "true") return true
  if (raw === "false") return false
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return raw
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return raw
}

/** Reads a doc's file; `name` says which in the errors. */
export function parseDocFile(source: string, name: string): DocFile {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
  if (!match) throw new Error(`${name}: no front matter (a block between --- lines at the top)`)

  const meta: Record<string, unknown> = {}
  for (const line of match[1]!.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue
    const colon = line.indexOf(":")
    if (colon < 1) throw new Error(`${name}: can't read the front matter line "${line}"`)
    const key = line.slice(0, colon).trim()
    if (!(KEYS as readonly string[]).includes(key)) {
      throw new Error(`${name}: unknown front matter key "${key}" (known: ${KEYS.join(", ")})`)
    }
    meta[key] = parseValue(line.slice(colon + 1).trim())
  }

  for (const key of REQUIRED) {
    if (typeof meta[key] !== "string" || !(meta[key] as string).trim()) {
      throw new Error(`${name}: front matter needs "${key}"`)
    }
  }
  for (const key of ["publishedAt", "revisedAt"] as const) {
    if (meta[key] !== undefined && !DAY.test(String(meta[key]))) {
      throw new Error(`${name}: "${key}" should be a day, YYYY-MM-DD`)
    }
  }
  if (meta.audience !== undefined) {
    const roles: string[] = [...STAFF_ROLES, "member"]
    if (!Array.isArray(meta.audience) || meta.audience.some((role) => !roles.includes(role))) {
      throw new Error(`${name}: "audience" should be a list of roles, e.g. [writer, editor]`)
    }
  }
  if (meta.showTableOfContents !== undefined && typeof meta.showTableOfContents !== "boolean") {
    throw new Error(`${name}: "showTableOfContents" should be true or false`)
  }

  return { meta: meta as unknown as DocFrontMatter, body: source.slice(match[0].length).trim() }
}

/** Quotes a string only where the flat YAML above would misread it. */
const formatValue = (value: string | boolean | string[]): string => {
  if (Array.isArray(value)) return `[${value.join(", ")}]`
  if (typeof value === "boolean") return String(value)
  const plain =
    value === value.trim() &&
    !/^["'[\]{}>|*&!%@`#,?:-]/.test(value) &&
    !/: | #/.test(value) &&
    !/^(true|false|null|~|yes|no|on|off)$/i.test(value)
  return plain ? value : JSON.stringify(value)
}

export function formatDocFile({ meta, body }: DocFile): string {
  const lines = KEYS.flatMap((key) => {
    const value = meta[key]
    if (value === undefined || (Array.isArray(value) && !value.length)) return []
    return [`${key}: ${formatValue(value)}`]
  })
  return `---\n${lines.join("\n")}\n---\n\n${body.trim()}\n`
}
