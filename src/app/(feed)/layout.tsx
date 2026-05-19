import { AdminBar } from "@/components/AdminBar"
import { getServerSideURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import { cn } from "@/utilities/utils"
import { ThemeProvider } from "@wrksz/themes/next"
import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import localFont from "next/font/local"
import React from "react"
import "../(frontend)/globals.css"

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

export default function FeedRootLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <html
      className={cn(FKScreamer.variable, geist.variable, "dark")}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <link href="/manifest.json" rel="manifest" />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <link href="/apple-touch-icon.png" rel="apple-touch-icon" sizes="180x180" />
      </head>
      <body className="bg-black text-white">
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
          <AdminBar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  title: "Feed · Pragmatic Papers",
  openGraph: mergeOpenGraph({ title: "Feed · Pragmatic Papers" }),
}
