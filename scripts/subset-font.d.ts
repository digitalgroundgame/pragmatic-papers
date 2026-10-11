// subset-font ships no types, and @types/subset-font predates its `keepFeatures` option.
declare module "subset-font" {
  interface SubsetFontOptions {
    targetFormat?: "sfnt" | "woff" | "woff2" | "truetype"
    /** OpenType feature tags to keep. Without it, every feature (and its glyphs) is kept. */
    keepFeatures?: string[]
  }

  export default function subsetFont(
    font: Buffer,
    text: string,
    options?: SubsetFontOptions,
  ): Promise<Buffer>
}
