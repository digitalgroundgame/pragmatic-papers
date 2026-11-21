// subset-font ships no types, and @types/subset-font predates its `keepFeatures` and
// `variationAxes` options.
declare module "subset-font" {
  interface SubsetFontOptions {
    targetFormat?: "sfnt" | "woff" | "woff2" | "truetype"
    /** OpenType feature tags to keep. Without it, every feature (and its glyphs) is kept. */
    keepFeatures?: string[]
    /** Pins a variable font's axes to a value, or narrows them to a range. */
    variationAxes?: Record<string, number | { min: number; max: number; default?: number }>
  }

  export default function subsetFont(
    font: Buffer,
    text: string,
    options?: SubsetFontOptions,
  ): Promise<Buffer>
}
