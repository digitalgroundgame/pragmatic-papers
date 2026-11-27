import { escapeHTML } from "@/utilities/feedHTML"
import { formatLongDate } from "@/utilities/formatDate"

import {
  barGroups,
  majorityOf,
  publicGroups,
  refusalForecast,
  refusalForecastLine,
  votingMembers,
  type WhipCountData,
} from "./model"
import { candidateColor, groupPaint, type Paint } from "./paint"
import { countdownLine } from "./seo"

/** The colors a picture is drawn in: the theme the page is showing, or the light theme. */
export interface PicturePalette {
  background: string
  ink: string
  quietInk: string
  /** A theme color as the page names it (`var(--chart-blue-4)`), resolved to a plain color. */
  color: (color: string) => string
}

/**
 * The light theme's values (globals.css `:root`) as hex, since the rasterizers can't read
 * oklch. `src/design/__tests__/oklch.test.ts` fails when one drifts from its token.
 */
export const LIGHT_COLORS: Record<string, string> = {
  "var(--chart-blue-4)": "#126ace",
  "var(--brand-fill)": "#e0330f",
  "var(--muted-foreground)": "#565656",
  "var(--warning)": "#d78e00",
  "var(--border)": "#e5e5e5",
  "var(--brand-text)": "#e0330f",
  "var(--foreground)": "#0a0a0a",
  "var(--chart-red-4)": "#d81334",
}

/** A theme color as the light theme draws it, for pictures drawn without the page. */
export const lightColor = (color: string): string => LIGHT_COLORS[color] ?? color

const LIGHT: PicturePalette = {
  background: "#ffffff",
  ink: "#171717",
  quietInk: "#525252",
  color: lightColor,
}

export interface WhipCountPicture {
  title: string
  data: WhipCountData
  palette?: PicturePalette
  /** The logo as standalone SVG markup, drawn in the bottom right corner. */
  logo?: string
  /** `@font-face` rules with the fonts inlined, so the picture needs nothing outside it. */
  fontFaces?: string
  /** When it is drawn, for the countdown to the vote; without it, no countdown. */
  now?: Date
}

const WIDTH = 1200
const PADDING = 56
const SANS = "Geist, 'Helvetica Neue', Arial, sans-serif"
// The eyebrow is the site's: Libertinus Serif, at the 112% the site scales it to.
const SERIF = "'Libertinus Serif', Georgia, 'Times New Roman', serif"
const LOGO_HEIGHT = 30

const round = (n: number): number => Math.round(n * 100) / 100

/** Roughly how wide text sets in Geist, which is enough to lay a legend out in a row. */
const textWidth = (text: string, size: number): number => text.length * size * 0.56

/** Roughly how wide Geist Bold sets digits, to put a forecast beside a big count. */
const digitsWidth = (text: string, size: number): number => text.length * size * 0.62

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
 * The public count as one standalone SVG, for a reader to save and share, laid out like the
 * link preview: the logo and the date, the title, the two candidates head to head at the
 * outer edges with any forecast inward, one rectangle a voter with the majority line, the
 * legend, and the countdown. Drawn from the same groups and paints as the page.
 */
export function drawWhipCountSVG({
  title,
  data,
  palette = LIGHT,
  logo,
  fontFaces,
  now,
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
    { weight = 400, color = palette.ink, anchor = "start", family = SANS, spacing = 0 } = {},
  ): string =>
    `<text x="${round(x)}" y="${round(y)}" font-family="${family}"${spacing ? ` letter-spacing="${spacing}"` : ""} font-size="${size}" font-weight="${weight}" fill="${escapeHTML(color)}" text-anchor="${anchor}">${escapeHTML(value)}</text>`

  const parts: string[] = []
  const count = (stance: "backs" | "leans", id: string): number =>
    groups.find((g) => g.stance === stance && g.candidate?.id === id)?.members.length ?? 0

  // The logo top left, as on the link preview, and the date across from it.
  const box = logo ? logoBox(logo) : null
  let y = PADDING
  if (box) {
    parts.push(
      `<svg x="${PADDING}" y="${y}" width="${round(box.width)}" height="${LOGO_HEIGHT}" viewBox="${escapeHTML(box.viewBox)}">${box.inner}</svg>`,
    )
  }
  const eyebrow = `WHIP COUNT · AS OF ${formatLongDate(`${data.asOf}T00:00:00Z`).toUpperCase()}`
  parts.push(
    text(box ? WIDTH - PADDING : PADDING, y + 22, 20, eyebrow, {
      weight: 700,
      color: palette.color("var(--brand-text)"),
      anchor: box ? "end" : "start",
      family: SERIF,
      spacing: 2,
    }),
  )
  y += 86
  parts.push(text(PADDING, y, 40, title, { weight: 600 }))

  if (data.candidates.length === 2) {
    // Head to head: each candidate at their own end of the bar, the count on the outer edge
    // and any forecast inward of it.
    y += 70
    const quiet = { color: palette.quietInk }
    data.candidates.forEach((candidate, i) => {
      const left = i === 0
      const edge = left ? PADDING : WIDTH - PADDING
      const anchor = left ? "start" : "end"
      const inward = left ? 1 : -1
      // The swatch on the outer edge, beside the name: no need to measure the name.
      const swatch = left ? edge : edge - 22
      const backs = String(count("backs", candidate.id))
      const leans = count("leans", candidate.id)
      const forecast = refusalForecast(data, candidate)
      parts.push(
        `<rect x="${round(swatch)}" y="${y - 24}" width="22" height="22" rx="4" ${fill({ color: candidateColor(data, candidate), opacity: 1 })}/>`,
        text(edge + inward * 36, y, 34, candidate.name, { weight: 700, anchor }),
        text(edge, y + 128, 136, backs, { weight: 700, anchor }),
        text(edge, y + 170, 22, leans > 0 ? `backing, plus ${leans} leaning` : "publicly backing", {
          ...quiet,
          anchor,
        }),
      )
      if (forecast) {
        parts.push(
          text(
            edge + inward * (digitsWidth(backs, 136) + 26),
            y + 128,
            64,
            String(forecast.total),
            {
              ...quiet,
              weight: 700,
              anchor,
            },
          ),
          text(edge, y + 200, 18, refusalForecastLine(forecast), { ...quiet, anchor }),
        )
      }
    })
    parts.push(text(WIDTH / 2, y + 90, 32, "vs", { ...quiet, weight: 700, anchor: "middle" }))
    y += 200
  } else {
    // The candidates' public backers, centred side by side.
    y += 150
    const step = Math.min(360, inner / data.candidates.length)
    const start = WIDTH / 2 - (step * (data.candidates.length - 1)) / 2
    data.candidates.forEach((candidate, i) => {
      const x = start + step * i
      const label = candidate.name
      const leans = count("leans", candidate.id)
      parts.push(
        text(x, y, 136, String(count("backs", candidate.id)), { weight: 700, anchor: "middle" }),
        `<rect x="${round(x - textWidth(label, 22) / 2 - 22)}" y="${y + 26}" width="14" height="14" rx="2" ${fill({ color: candidateColor(data, candidate), opacity: 1 })}/>`,
        text(x + 10, y + 40, 22, label, { weight: 500, anchor: "middle" }),
        text(x, y + 68, 17, leans > 0 ? `backing, plus ${leans} leaning` : "publicly backing", {
          color: palette.quietInk,
          anchor: "middle",
        }),
      )
    })
    y += 68
  }

  // One rectangle a voter, and the line a candidate has to reach.
  y += 76
  const gap = 4
  const width = (inner - gap * (voters.length - 1)) / voters.length
  let index = 0
  for (const group of barGroups(groups)) {
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

  // The footer: what the count is, and the countdown in an ink badge, as on the link preview.
  y += 64
  parts.push(
    text(
      PADDING,
      y,
      17,
      `${majority} of ${voters.length} votes to win · public statements, not votes: the ballot is secret.`,
      {
        color: palette.quietInk,
      },
    ),
  )
  const countdown = now ? countdownLine(data, now) : null
  if (countdown) {
    const badge = textWidth(countdown, 22) + 44
    parts.push(
      `<rect x="${round(WIDTH - PADDING - badge)}" y="${y - 32}" width="${round(badge)}" height="46" rx="6" fill="${escapeHTML(palette.ink)}"/>`,
      text(WIDTH - PADDING - badge / 2, y - 2, 22, countdown, {
        weight: 700,
        color: palette.background,
        anchor: "middle",
      }),
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
