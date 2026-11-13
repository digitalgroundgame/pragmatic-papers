import { escapeHTML } from "@/utilities/feedHTML"
import { formatLongDate } from "@/utilities/formatDate"

import { majorityOf, publicGroups, votingMembers, type WhipCountData } from "./model"
import { candidateColor, groupPaint, type Paint } from "./paint"

/** The colors a picture is drawn in: the theme the page is showing, or the light theme. */
export interface PicturePalette {
  background: string
  ink: string
  quietInk: string
  /** A theme color as the page names it (`var(--chart-3)`), resolved to a plain color. */
  color: (color: string) => string
}

const LIGHT_COLORS: Record<string, string> = {
  "var(--chart-3)": "#155dfc",
  "var(--brand-fill)": "#e2330f",
  "var(--muted-foreground)": "#737373",
  "var(--warning)": "#d78e00",
  "var(--border)": "#e5e5e5",
}

const LIGHT: PicturePalette = {
  background: "#ffffff",
  ink: "#171717",
  quietInk: "#525252",
  color: (color) => LIGHT_COLORS[color] ?? color,
}

export interface WhipCountPicture {
  title: string
  data: WhipCountData
  palette?: PicturePalette
  /** The logo as standalone SVG markup, drawn in the bottom right corner. */
  logo?: string
  /** `@font-face` rules with the fonts inlined, so the picture needs nothing outside it. */
  fontFaces?: string
}

const WIDTH = 1200
const PADDING = 56
const SANS = "Geist, 'Helvetica Neue', Arial, sans-serif"
const LOGO_HEIGHT = 22

const round = (n: number): number => Math.round(n * 100) / 100

/** Roughly how wide text sets in Geist, which is enough to lay a legend out in a row. */
const textWidth = (text: string, size: number): number => text.length * size * 0.56

/** The markup inside a logo's `<svg>`, with its viewBox and its width at `LOGO_HEIGHT`. */
function logoBox(logo: string): { viewBox: string; width: number; inner: string } | null {
  const open = /^\s*<svg\b([^>]*)>/i.exec(logo)
  const close = logo.lastIndexOf("</svg>")
  const viewBox = /\bviewBox="([^"]+)"/.exec(open?.[1] ?? "")?.[1]
  const [, , width, height] = (viewBox ?? "").split(/[\s,]+/).map(Number)
  if (!open || close < 0 || !viewBox || !width || !height) return null
  return {
    viewBox,
    width: (LOGO_HEIGHT * width) / height,
    inner: logo.slice(open[0].length, close),
  }
}

/**
 * The public count as one standalone SVG, for a reader to save and share: the title, the
 * candidates' totals, one rectangle a voter with the majority line, the legend, and the logo
 * in the bottom right. Drawn from the same groups and paints as the page.
 */
export function drawWhipCountSVG({
  title,
  data,
  palette = LIGHT,
  logo,
  fontFaces,
}: WhipCountPicture): string {
  const voters = votingMembers(data)
  const groups = publicGroups(data)
  const majority = majorityOf(voters.length)
  const inner = WIDTH - PADDING * 2
  const fill = ({ color, opacity }: Paint): string =>
    `fill="${escapeHTML(palette.color(color))}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ""}`
  const text = (
    x: number,
    y: number,
    size: number,
    value: string,
    { weight = 400, color = palette.ink, anchor = "start" } = {},
  ): string =>
    `<text x="${round(x)}" y="${round(y)}" font-family="${SANS}" font-size="${size}" font-weight="${weight}" fill="${escapeHTML(color)}" text-anchor="${anchor}">${escapeHTML(value)}</text>`

  const parts: string[] = []
  let y = PADDING + 14
  parts.push(
    text(PADDING, y, 16, `AS OF ${formatLongDate(`${data.asOf}T00:00:00Z`).toUpperCase()}`, {
      weight: 600,
      color: palette.quietInk,
    }),
  )
  y += 46
  parts.push(text(PADDING, y, 40, title, { weight: 600 }))

  // The candidates' public backers, centred side by side.
  y += 150
  const step = Math.min(360, inner / data.candidates.length)
  const start = WIDTH / 2 - (step * (data.candidates.length - 1)) / 2
  data.candidates.forEach((candidate, i) => {
    const x = start + step * i
    const count = (stance: "backs" | "leans"): number =>
      groups.find((g) => g.stance === stance && g.candidate?.id === candidate.id)?.members.length ??
      0
    const label = `Back ${candidate.short}`
    parts.push(text(x, y, 136, String(count("backs")), { weight: 700, anchor: "middle" }))
    parts.push(
      `<rect x="${round(x - textWidth(label, 22) / 2 - 22)}" y="${y + 26}" width="14" height="14" rx="2" ${fill({ color: candidateColor(data, candidate), opacity: 1 })}/>`,
      text(x + 10, y + 40, 22, label, { weight: 500, anchor: "middle" }),
      text(
        x,
        y + 68,
        17,
        count("leans") > 0 ? `plus ${count("leans")} leaning` : "publicly committed",
        { color: palette.quietInk, anchor: "middle" },
      ),
    )
  })

  // One rectangle a voter, and the line a candidate has to reach.
  y += 132
  const gap = 4
  const width = (inner - gap * (voters.length - 1)) / voters.length
  let index = 0
  for (const group of groups) {
    for (let i = 0; i < group.members.length; i++, index++) {
      parts.push(
        `<rect x="${round(PADDING + index * (width + gap))}" y="${y}" width="${round(width)}" height="56" rx="3" ${fill(groupPaint(data, group))}/>`,
      )
    }
  }
  const line = PADDING + majority * (width + gap) - gap / 2
  parts.push(
    `<rect x="${round(line - 1.5)}" y="${y - 30}" width="3" height="86" fill="${escapeHTML(palette.ink)}"/>`,
    text(line + 8, y - 14, 16, `${majority} to win`, { weight: 500 }),
  )

  // The legend, wrapped onto as many rows as it needs.
  y += 92
  let x = PADDING
  for (const group of groups) {
    const label = `${group.members.length} ${group.label}`
    const needed = 22 + textWidth(label, 17) + 28
    if (x + needed > WIDTH - PADDING && x > PADDING) {
      x = PADDING
      y += 30
    }
    parts.push(
      `<rect x="${round(x)}" y="${y - 12}" width="13" height="13" rx="2" ${fill(groupPaint(data, group))}/>`,
      text(x + 22, y, 17, label, { color: palette.quietInk }),
    )
    x += needed
  }

  y += 56
  parts.push(
    text(PADDING, y, 15, "Public statements, not votes: the ballot is secret.", {
      color: palette.quietInk,
    }),
  )
  const box = logo ? logoBox(logo) : null
  if (box) {
    parts.push(
      `<svg x="${round(WIDTH - PADDING - box.width)}" y="${y - LOGO_HEIGHT + 4}" width="${round(box.width)}" height="${LOGO_HEIGHT}" viewBox="${escapeHTML(box.viewBox)}">${box.inner}</svg>`,
    )
  }
  const height = y + PADDING - 10

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">`,
    fontFaces ? `<style>${fontFaces}</style>` : "",
    `<rect width="${WIDTH}" height="${height}" fill="${escapeHTML(palette.background)}"/>`,
    ...parts,
    "</svg>",
  ].join("")
}
