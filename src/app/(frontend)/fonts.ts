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

// Geist comes from Vercel's `geist` package, trimmed to the latin characters and weights
// 400–600 at install (scripts/install-fonts.ts), so a build never fetches it:
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

export const fontVariables = cn(FKScreamer.variable, geist.variable)
