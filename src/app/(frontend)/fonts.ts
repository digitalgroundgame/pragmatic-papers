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

// Geist ships with the repo, so a build never fetches it: next/font/google downloads it
// from Google on every build, and fails the build when Google's answer is off. The file is
// Google Fonts' "latin" subset of Geist v5, the variable font Google served for these
// weights; other characters fall back per character. Like Google's CSS, both weights are
// faces of the one file. Geist is under the SIL Open Font License (_fonts/Geist-OFL.txt).
const geist = localFont({
  src: [
    { path: "./_fonts/Geist-latin.woff2", weight: "400", style: "normal" },
    { path: "./_fonts/Geist-latin.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  // These faces (globals.css) are sized to Geist's widths, as next/font/google left them.
  adjustFontFallback: false,
  fallback: ["Geist Fallback Arial", "Geist Fallback Roboto", "Helvetica", "Arial", "sans-serif"],
  variable: "--font-sans",
})

export const fontVariables = cn(FKScreamer.variable, geist.variable)
