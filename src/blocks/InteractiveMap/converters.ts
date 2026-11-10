import type { InteractiveMapBlock, Media } from "@/payload-types"
import { escapeHTML, type FeedContext } from "@/utilities/feedHTML"
import { absoluteURL } from "@/utilities/getURL"
import { isResolved } from "@/utilities/relationships"

import { resolveInlineSvgMap } from "./adapters/inlineSvg"
import {
  getDivergingRedBlueLegend,
  staticColor,
  STATIC_NEUTRAL,
  type ColorScaleType,
} from "./colorScale"
import type { ResolvedMap } from "./types"

const SITE_NAME = "The Pragmatic Papers"

/**
 * A link back to the page the map sits on: the map needs the site's script to
 * draw and its tooltips to read, which no feed reader runs.
 */
export const interactiveMapToHTML = (
  { widgetTitle }: Pick<InteractiveMapBlock, "widgetTitle">,
  { pageUrl }: Pick<FeedContext, "pageUrl">,
): string => {
  const title = widgetTitle ? `“${escapeHTML(widgetTitle)}” ` : ""
  return `<p><a href="${escapeHTML(pageUrl)}">View the interactive map ${title}on ${SITE_NAME} →</a></p>`
}

type MapFields = Pick<
  InteractiveMapBlock,
  "widgetTitle" | "layout" | "colorScale" | "colorBias" | "maps"
>

/** What the image says in words: the widget's title, or else its maps' titles. */
export const interactiveMapAlt = ({ widgetTitle, maps }: MapFields): string => {
  const titles = (maps ?? []).map(({ title }) => title?.trim()).filter(Boolean)
  const name = widgetTitle?.trim() || titles.join(", ")
  return name ? `Map: ${name}` : "Map"
}

/** A map block whose image the feed's query found (`attachMapImages`). */
export type InteractiveMapWithImage = InteractiveMapBlock & { feedImage?: Media | null }

/**
 * The map as a picture: the image rendered when the article was published, captioned with a
 * link to the interactive version. A map with no image yet gets `interactiveMapToHTML`'s link.
 * This only points at the stored image; it never draws one.
 */
export const interactiveMapToImage = (
  fields: InteractiveMapWithImage,
  context: Pick<FeedContext, "pageUrl" | "siteUrl">,
): string => {
  const image = fields.feedImage
  if (!isResolved(image) || !image.url) return interactiveMapToHTML(fields, context)

  const src = escapeHTML(absoluteURL(image.url, context.siteUrl))
  const alt = escapeHTML(image.alt || interactiveMapAlt(fields))
  const size = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : ""
  const caption = `<a href="${escapeHTML(context.pageUrl)}">View the interactive version on ${SITE_NAME}</a>`
  return `<figure><img src="${src}" alt="${alt}"${size} /><figcaption>${caption}</figcaption></figure>`
}

// The drawing's own units. Substack's column is about 680px wide, and the image is drawn
// at twice that for dense screens.
const WIDTH = 680
const PIXEL_DENSITY = 2
const PADDING = 16
const GAP = 12
// The site's sans, which the legend uses on the page and the deployed image installs
// (dockerfiles/), then the image's fallback, so a picture drawn in development looks like
// production's wherever those fonts are installed.
const FONT = "Geist, Helvetica, Arial, sans-serif"
// The article's serif, which the map's title and its sources sit in on the page: Libertinus
// Serif, which the deployed image installs and a download embeds.
const SERIF = "'Libertinus Serif', Georgia, 'Times New Roman', serif"
/** The colors a picture is drawn in. `LIGHT` is the light theme's, on white. */
export interface MapPalette {
  background: string
  ink: string
  quietInk: string
  /** The lines between regions. */
  outline: string
  /** A region's or legend swatch's color as the page gives it (`var(--map-…, fallback)`). */
  color: (color: string) => string
}

const LIGHT: MapPalette = {
  background: "#ffffff",
  ink: "#171717",
  quietInk: "#525252",
  outline: "#ffffff",
  color: staticColor,
}

const round = (n: number): number => Math.round(n * 100) / 100
// The page draws Libertinus at 112% (`size-adjust` in fonts.ts), so a serif size here is
// scaled the same way to match it.
const serif = (size: number): number => round(size * 1.12)

// Libertinus comes in regular and bold, so the page's semibold title is drawn bold and its
// medium map titles regular, as a browser picks them.
const TITLE = { size: serif(18), line: 24, weight: 700, family: SERIF }
const MAP_TITLE = { size: serif(14), line: 20, weight: 400, family: SERIF }
const LEGEND = { swatch: 16, size: 11, line: 16, gap: 4 }

/** Break a title into lines that fit `width`, judging by an average character's width. */
function wrap(title: string, size: number, width: number): string[] {
  const perLine = Math.max(8, Math.floor(width / (size * 0.6)))
  const lines: string[] = []
  let line = ""
  for (const word of title.trim().split(/\s+/)) {
    if (line && line.length + 1 + word.length > perLine) {
      lines.push(line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(line)
  return lines
}

function text(
  lines: string[],
  { size, line, weight, family }: { size: number; line: number; weight?: number; family?: string },
  x: number,
  y: number,
  fill: string,
  anchor: "start" | "middle" = "middle",
): string {
  return lines
    .map(
      (content, i) =>
        `<text x="${round(x)}" y="${round(y + i * line + size)}"${
          family ? ` font-family="${family}"` : ""
        } font-size="${size}"${weight ? ` font-weight="${weight}"` : ""} fill="${fill}" text-anchor="${anchor}">${escapeHTML(content)}</text>`,
    )
    .join("")
}

/** A viewBox's size, or a square when it can't be read. */
function viewBoxSize(viewBox: string): { width: number; height: number } {
  const [, , width, height] = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  return width && height && width > 0 && height > 0 ? { width, height } : { width: 1, height: 1 }
}

const ATTRIBUTE_NAME = /^[A-Za-z_][\w:.-]*$/

function attributes(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .filter(([name]) => ATTRIBUTE_NAME.test(name))
    .map(([name, value]) => ` ${name}="${escapeHTML(value)}"`)
    .join("")
}

/** One map, shaded, fitted into the box at (x, y). */
function mapMarkup(
  map: ResolvedMap,
  x: number,
  y: number,
  width: number,
  height: number,
  palette: MapPalette,
): string {
  const paths = map.paths
    .map((path) =>
      path.region
        ? `<path d="${escapeHTML(path.d)}" fill="${escapeHTML(palette.color(path.region.color))}" stroke="${escapeHTML(palette.outline)}" stroke-width="1" vector-effect="non-scaling-stroke" />`
        : `<path d="${escapeHTML(path.d)}"${attributes(path.extraAttrs)} />`,
    )
    .join("")
  const transform = map.transform ? ` transform="${escapeHTML(map.transform)}"` : ""
  return `<svg x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" viewBox="${escapeHTML(map.viewBox)}" preserveAspectRatio="xMidYMid meet"><g${transform}>${paths}</g></svg>`
}

export interface MapDrawing {
  widgetTitle?: string | null
  layout?: InteractiveMapBlock["layout"]
  scaleType: ColorScaleType
  colorBias?: number | null
  /** Resolved as the page resolves them; theme colors are drawn as the light theme's. */
  maps: ResolvedMap[]
  /**
   * A last row for a picture shared on its own: the sources on the left and the logo on the
   * right, so the picture says where it's from.
   */
  footer?: {
    sources?: readonly string[]
    /** The logo as standalone SVG markup, drawn 10 units tall. */
    logo?: string
  }
  /**
   * `@font-face` rules embedded in the picture. A browser drawing an SVG as an image loads
   * no fonts of the page's, so a picture drawn there brings its own.
   */
  fontFaces?: string
  /** The theme to draw in; the light theme's colors when left out. */
  palette?: MapPalette
}

const FOOTER = { size: serif(11), line: 16, logo: 10, family: SERIF }

/** A logo's viewBox, its width at the footer's height, and the markup inside its `<svg>`. */
function logoBox(logo: string): { viewBox: string; width: number; inner: string } | null {
  const open = /^\s*<svg\b([^>]*)>/i.exec(logo)
  const close = logo.lastIndexOf("</svg>")
  if (!open || close < 0) return null
  const viewBox = /\bviewBox="([^"]+)"/.exec(open[1] ?? "")?.[1]
  if (!viewBox) return null
  const size = viewBoxSize(viewBox)
  return {
    viewBox,
    width: (FOOTER.logo * size.width) / size.height,
    inner: logo.slice(open[0].length, close),
  }
}

/** Resolved maps drawn as one standalone SVG (see `interactiveMapToSVG`). */
export const drawInteractiveMapSVG = (fields: MapDrawing): string => {
  const { scaleType, maps } = fields
  const palette = fields.palette ?? LIGHT
  const inner = WIDTH - PADDING * 2
  const parts: string[] = []
  let y = PADDING

  if (fields.widgetTitle?.trim()) {
    const lines = wrap(fields.widgetTitle, TITLE.size, inner)
    parts.push(text(lines, TITLE, WIDTH / 2, y, palette.ink))
    y += lines.length * TITLE.line + GAP
  }

  // Side by side, or one under another. Maps in a row start level, under the tallest title.
  const perRow = fields.layout === "stacked" ? 1 : maps.length
  const column = (inner - GAP * (perRow - 1)) / perRow
  for (let start = 0; start < maps.length; start += perRow) {
    const row = maps.slice(start, start + perRow).map((map) => {
      const label = map.title && map.invertColors ? `${map.title} (Inverted)` : map.title
      const size = viewBoxSize(map.viewBox)
      return {
        map,
        lines: label?.trim() ? wrap(label, MAP_TITLE.size, column) : [],
        height: (column * size.height) / size.width,
      }
    })
    const titleLines = Math.max(...row.map(({ lines }) => lines.length))
    const titleHeight = titleLines ? titleLines * MAP_TITLE.line + GAP / 2 : 0
    row.forEach(({ map, lines, height }, i) => {
      const x = PADDING + i * (column + GAP)
      parts.push(text(lines, MAP_TITLE, x + column / 2, y, palette.ink))
      parts.push(mapMarkup(map, x, y + titleHeight, column, height, palette))
    })
    y += titleHeight + Math.max(...row.map(({ height }) => height)) + GAP
  }

  if (scaleType === "divergingRedBlue") {
    const legend = getDivergingRedBlueLegend(fields.colorBias)
    const swatch = (inner - LEGEND.gap * (legend.length - 1)) / legend.length
    legend.forEach(({ color, label }, i) => {
      const x = PADDING + i * (swatch + LEGEND.gap)
      parts.push(
        `<rect x="${round(x)}" y="${round(y)}" width="${round(swatch)}" height="${LEGEND.swatch}" rx="2" fill="${escapeHTML(palette.color(color))}" />`,
      )
      parts.push(text([label], LEGEND, x + swatch / 2, y + LEGEND.swatch + 2, palette.quietInk))
    })
    y += LEGEND.swatch + 2 + LEGEND.line + GAP
  }

  if (fields.footer) {
    const { sources = [], logo } = fields.footer
    const logoSize = logo ? logoBox(logo) : null
    if (sources.length) {
      const label = `Source${sources.length > 1 ? "s" : ""}: ${sources.join(", ")}`
      const room = inner - (logoSize ? logoSize.width + GAP : 0)
      const lines = wrap(label, FOOTER.size, room)
      parts.push(text(lines, FOOTER, PADDING, y, palette.quietInk, "start"))
      y += Math.max(lines.length * FOOTER.line, FOOTER.line) + GAP
    } else if (logoSize) {
      y += FOOTER.line + GAP
    }
    if (logo && logoSize) {
      const top = y - GAP - FOOTER.line + (FOOTER.line - FOOTER.logo) / 2
      parts.push(
        `<svg x="${round(WIDTH - PADDING - logoSize.width)}" y="${round(top)}" width="${round(logoSize.width)}" height="${FOOTER.logo}" viewBox="${escapeHTML(logoSize.viewBox)}">${logoSize.inner}</svg>`,
      )
    }
  }

  const height = Math.ceil(y - GAP + PADDING)
  const defs = fields.fontFaces ? `<defs><style>${fields.fontFaces}</style></defs>` : ""
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH * PIXEL_DENSITY}" height="${height * PIXEL_DENSITY}" viewBox="0 0 ${WIDTH} ${height}" font-family="${FONT}">${defs}<rect width="${WIDTH}" height="${height}" fill="${escapeHTML(palette.background)}" />${parts.join("")}</svg>`
}

/**
 * The block as one standalone SVG: its title, each map shaded as the page shades it
 * (`resolveInlineSvgMap`, the component's own resolver), and the legend, which a picture
 * needs since nobody can hover it. Colors are the light theme's, on white. Null when no map
 * has its SVG loaded. Plain markup with no stylesheet, so an image library can rasterize it.
 */
export const interactiveMapToSVG = (fields: MapFields): string | null => {
  const scaleType = fields.colorScale ?? "divergingRedBlue"
  const maps = (fields.maps ?? []).flatMap((map) => {
    const svg = isResolved(map.svgAsset) ? map.svgAsset.svgContent : null
    if (!svg) return []
    return [
      resolveInlineSvgMap({
        title: map.title,
        svg,
        dataAttribute: map.dataAttribute,
        overrides: map.overrides,
        scaleType,
        colorBias: fields.colorBias,
        invertColors: map.invertColors,
        neutralFill: STATIC_NEUTRAL,
      }),
    ]
  })
  if (maps.length === 0) return null
  return drawInteractiveMapSVG({ ...fields, scaleType, maps })
}
