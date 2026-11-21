import sharp from "@/cloudflare/sharp"

/**
 * Rasterize the block's SVG (`interactiveMapToSVG`) as a PNG, at the size the SVG names.
 * Server-only, and only where `sharp` runs: the Coolify app, which is where articles are
 * saved. The Worker's build swaps `sharp` for a stub that throws.
 */
export async function renderMapImage(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer()
}
