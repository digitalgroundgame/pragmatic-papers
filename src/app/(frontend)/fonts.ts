import { cn } from "@/utilities/utils"
import { Geist } from "next/font/google"
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

// Next has no metrics for Geist, so it generates no fallback of its own.
const geist = Geist({
  weight: ["400", "600"],
  subsets: ["latin"],
  fallback: ["Geist Fallback Arial", "Geist Fallback Roboto", "Helvetica", "Arial", "sans-serif"],
  variable: "--font-sans",
})

export const fontVariables = cn(FKScreamer.variable, geist.variable)
