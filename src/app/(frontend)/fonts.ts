import { cn } from "@/utilities/utils"
import { Geist } from "next/font/google"
import localFont from "next/font/local"

const FKScreamer = localFont({
  src: "../../../public/fonts/FKScreamer-Bold.woff2",
  weight: "700",
  display: "swap",
  fallback: ["fantasy", "sans-serif"],
  variable: "--font-display",
})

const geist = Geist({
  weight: ["400", "600"],
  subsets: ["latin"],
  fallback: ["Helvetica", "Arial", "sans-serif"],
  variable: "--font-sans",
})

export const fontVariables = cn(FKScreamer.variable, geist.variable)
