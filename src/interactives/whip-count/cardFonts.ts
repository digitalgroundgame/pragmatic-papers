import { readFile } from "node:fs/promises"
import { join } from "node:path"

/** A font the link preview card draws with, as `next/og` takes it. */
export interface CardFont {
  name: string
  data: ArrayBuffer
  weight: 400 | 600 | 700
}

/**
 * The site's fonts in the weights the card uses: Geist, and Libertinus Serif Bold for the
 * eyebrow. `file` is where the package keeps the TTF (`next/og` can't read woff2), which
 * `outputFileTracingIncludes` copies into the Coolify build. The Worker has no files to read,
 * so `pnpm build:worker` copies each into its static assets at `asset` instead.
 */
export const CARD_FONTS = [
  {
    name: "Geist",
    weight: 400,
    file: "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
    asset: "/og-fonts/Geist-Regular.ttf",
  },
  {
    name: "Geist",
    weight: 600,
    file: "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf",
    asset: "/og-fonts/Geist-SemiBold.ttf",
  },
  {
    name: "Geist",
    weight: 700,
    file: "node_modules/geist/dist/fonts/geist-sans/Geist-Bold.ttf",
    asset: "/og-fonts/Geist-Bold.ttf",
  },
  {
    name: "Libertinus Serif",
    weight: 700,
    file: "node_modules/@expo-google-fonts/libertinus-serif/700Bold/LibertinusSerif_700Bold.ttf",
    asset: "/og-fonts/LibertinusSerif-700Bold.ttf",
  },
] as const satisfies readonly {
  name: string
  weight: CardFont["weight"]
  file: string
  asset: string
}[]

interface Assets {
  fetch: (input: Request | URL | string) => Promise<Response>
}

/**
 * The Worker's static assets, from the context OpenNext's Worker entry puts on the global
 * scope for each request (what `getCloudflareContext()` reads). Undefined outside the Worker.
 */
function workerAssets(): Assets | undefined {
  const context = (globalThis as Record<symbol, { env?: { ASSETS?: Assets } } | undefined>)[
    Symbol.for("__cloudflare-context__")
  ]
  return context?.env?.ASSETS
}

const fromFile = async (file: string): Promise<ArrayBuffer> => {
  const bytes = await readFile(join(process.cwd(), file))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

const fromAssets = async (assets: Assets, path: string): Promise<ArrayBuffer> => {
  const response = await assets.fetch(new URL(path, "https://assets.local"))
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return response.arrayBuffer()
}

/**
 * The card's fonts: read from the packages on Coolify, or from the Worker's static assets.
 * Undefined when neither has them, and `next/og` then draws everything in its own Geist
 * Regular.
 */
export async function loadCardFonts(): Promise<CardFont[] | undefined> {
  const load = async (read: (font: (typeof CARD_FONTS)[number]) => Promise<ArrayBuffer>) =>
    Promise.all(
      CARD_FONTS.map(async (font) => ({
        name: font.name,
        weight: font.weight,
        data: await read(font),
      })),
    )
  try {
    return await load((font) => fromFile(font.file))
  } catch {
    const assets = workerAssets()
    if (!assets) return undefined
    try {
      return await load((font) => fromAssets(assets, font.asset))
    } catch {
      return undefined
    }
  }
}
