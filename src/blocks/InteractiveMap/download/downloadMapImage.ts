import { drawInteractiveMapSVG, type MapDrawing, type MapPalette } from "../converters"

/** The site's body font, which `scripts/install-fonts.ts` puts in `public/fonts`. */
const FONT_URL = "/fonts/Geist-latin.woff2"

type Download = Omit<MapDrawing, "footer" | "fontFaces" | "palette"> & {
  sources?: readonly string[]
  /**
   * The logo as the page draws it. Its colors, and the picture's, are the theme the page is
   * showing around it, so a reader in dark mode gets a dark picture.
   */
  logo: Element | null
}

const round = (n: number): number => Math.round(n * 1000) / 1000

let probe: CanvasRenderingContext2D | null | undefined

/**
 * Any CSS color as `rgb()`/`rgba()`, by painting one pixel with it: the page's tokens are
 * `oklch()`, which an image library or an older browser may not read inside an SVG.
 */
export function toSRGB(color: string): string {
  probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  if (!probe || !color) return color
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = "#000"
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${round(a! / 255)})`
}

const VAR = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/

/** The theme `element` is shown in, as the picture's colors. */
export function themePalette(element: Element): MapPalette {
  const style = getComputedStyle(element)
  const token = (name: string) => toSRGB(style.getPropertyValue(name).trim())
  const color = (value: string): string => {
    const match = VAR.exec(value.trim())
    if (!match) return toSRGB(value)
    const own = style.getPropertyValue(match[1]!).trim()
    return own ? toSRGB(own) : color(match[2] ?? "")
  }
  return {
    background: token("--background"),
    ink: token("--foreground"),
    quietInk: token("--muted-foreground"),
    outline: token("--background"),
    color,
  }
}

/** `widgetTitle` as a file name: "Districts & margins" is `districts-margins.png`. */
export function mapFileName(title: string | null | undefined): string {
  const slug = (title ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 80)
  return `${slug || "map"}.png`
}

/**
 * The font as an `@font-face` rule with the file inlined: a browser drawing an SVG as an
 * image loads nothing outside it. Without it, the picture falls back to a system font.
 */
async function fontFace(): Promise<string | undefined> {
  try {
    const response = await fetch(FONT_URL)
    if (!response.ok) return undefined
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ""
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    }
    return `@font-face{font-family:Geist;font-weight:100 900;src:url(data:font/woff2;base64,${btoa(binary)}) format("woff2")}`
  } catch {
    return undefined
  }
}

/**
 * The logo as standalone markup, in `ink`. Its parts colored by a class (the brand-colored
 * paper) keep the color the page computed, since the picture has no stylesheet.
 */
export function logoMarkup(logo: Element | null, ink: string): string | undefined {
  if (!logo) return undefined
  const copy = logo.cloneNode(true) as Element
  const originals = [logo, ...logo.querySelectorAll("*")]
  const copies = [copy, ...copy.querySelectorAll("*")]
  copies.forEach((part, i) => {
    if (i > 0 && part.hasAttribute("class")) {
      const fill = getComputedStyle(originals[i]!).fill
      if (fill && fill !== "none") part.setAttribute("fill", toSRGB(fill))
    }
    part.removeAttribute("class")
  })
  copy.setAttribute("fill", ink)
  return new XMLSerializer().serializeToString(copy)
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("The map's picture did not load"))
    image.src = url
  })
}

/** Draws the map, with a footer naming its sources and the logo, and saves it as a PNG. */
export async function downloadMapImage({ sources, logo, ...drawing }: Download): Promise<void> {
  const palette = logo ? themePalette(logo) : undefined
  const svg = drawInteractiveMapSVG({
    ...drawing,
    palette,
    footer: { sources, logo: logoMarkup(logo, palette?.ink ?? "#171717") },
    fontFaces: await fontFace(),
  })
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
  try {
    const image = await loadImage(svgUrl)
    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    canvas.getContext("2d")?.drawImage(image, 0, 0)
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
    if (!png) throw new Error("The map could not be saved as a PNG")

    const pngUrl = URL.createObjectURL(png)
    const link = document.createElement("a")
    link.href = pngUrl
    link.download = mapFileName(drawing.widgetTitle)
    link.click()
    // Some browsers start the download after the click returns, so the file stays a while.
    setTimeout(() => URL.revokeObjectURL(pngUrl), 60_000)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}
