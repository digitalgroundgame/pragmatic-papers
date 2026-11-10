import { drawInteractiveMapSVG, type MapDrawing } from "../converters"

/** The site's body font, which `scripts/install-fonts.ts` puts in `public/fonts`. */
const FONT_URL = "/fonts/Geist-latin.woff2"
const LOGO_INK = "#171717"

type Download = Omit<MapDrawing, "footer" | "fontFaces"> & {
  sources?: readonly string[]
  /** The logo as the page draws it; its `currentColor` is drawn in ink. */
  logo: Element | null
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

function logoMarkup(logo: Element | null): string | undefined {
  if (!logo) return undefined
  const copy = logo.cloneNode(true) as Element
  copy.removeAttribute("class")
  copy.setAttribute("fill", LOGO_INK)
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
  const svg = drawInteractiveMapSVG({
    ...drawing,
    footer: { sources, logo: logoMarkup(logo) },
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
