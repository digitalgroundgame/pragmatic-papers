import { cn } from "@/utilities/utils"
import localFont from "next/font/local"

const FKScreamer = localFont({
  src: "../../../public/fonts/FKScreamer-Bold.woff2",
  weight: "700",
  display: "swap",
  // Next's own fallback is Arial alone, which Android doesn't have, so phones there
  // laid headings out in an unmatched font and reflowed when FKScreamer arrived. These
  // faces (globals.css) cover Impact, Arial and Roboto, sized to FKScreamer's widths.
  adjustFontFallback: false,
  fallback: [
    "FKScreamer Fallback Impact",
    "FKScreamer Fallback Arial",
    "FKScreamer Fallback Roboto",
    "sans-serif",
  ],
  variable: "--font-display",
})

// Geist comes from Vercel's `geist` package, trimmed to Latin and Latin Extended-A and
// weights 400–600 at install (scripts/install-fonts.ts), so a build never fetches it:
// next/font/google downloads it from Google on every build, and fails the build when
// Google's answer is off. Like Google's CSS, both weights are faces of the one variable
// file.
const geist = localFont({
  src: [
    { path: "../../../public/fonts/Geist-latin.woff2", weight: "400", style: "normal" },
    { path: "../../../public/fonts/Geist-latin.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  // These faces (globals.css) are sized to Geist's widths, as next/font/google left them.
  adjustFontFallback: false,
  fallback: ["Geist Fallback Arial", "Geist Fallback Roboto", "Helvetica", "Arial", "sans-serif"],
  variable: "--font-sans",
})

// Libertinus Serif, the serif in the design spec, from the `@expo-google-fonts/libertinus-serif`
// package, trimmed at install like Geist (scripts/install-fonts.ts). Every reader gets the
// same serif, so the map pictures drawn on the server can match the page. Libertinus is
// drawn small: its x-height is 0.429 em where Georgia's, which most readers saw before,
// is 0.481, so it's scaled up 112% to read at Georgia's size.
//
// Only Geist and FKScreamer are preloaded: preloading all four faces would add 120 kB to
// every page. The fallback faces (globals.css) are sized to Libertinus' widths, so text
// keeps its lines when the font arrives.
const libertinusSerif = localFont({
  src: [
    {
      path: "../../../public/fonts/LibertinusSerif-400Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../public/fonts/LibertinusSerif-400Regular_Italic.woff2",
      weight: "400",
      style: "italic",
    },
    { path: "../../../public/fonts/LibertinusSerif-700Bold.woff2", weight: "700", style: "normal" },
    {
      path: "../../../public/fonts/LibertinusSerif-700Bold_Italic.woff2",
      weight: "700",
      style: "italic",
    },
  ],
  display: "swap",
  preload: false,
  declarations: [{ prop: "size-adjust", value: "112%" }],
  adjustFontFallback: false,
  fallback: [
    "Libertinus Fallback Georgia",
    "Libertinus Fallback Times",
    "Libertinus Fallback Noto",
    "serif",
  ],
  variable: "--font-serif",
})

export const fontVariables = cn(FKScreamer.variable, geist.variable, libertinusSerif.variable)
