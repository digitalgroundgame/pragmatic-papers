import { AdminBar } from "@/components/AdminBar"
import { getServerSideURL } from "@/utilities/getURL"
import { mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import { ThemeProvider } from "@wrksz/themes/next"
import type { Metadata, Viewport } from "next"
import React from "react"
import { fontVariables } from "@/app/(frontend)/fonts"
import "@/app/(frontend)/globals.css"

export default function FeedRootLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <html className={fontVariables} lang="en" suppressHydrationWarning>
      <head>
        <link href="/manifest.json" rel="manifest" />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <link href="/apple-touch-icon.png" rel="apple-touch-icon" sizes="180x180" />
      </head>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          // The feed is designed dark only: its overlays are white over the page.
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <AdminBar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  title: "Feed · Pragmatic Papers",
  openGraph: mergeOpenGraph({ title: "Feed · Pragmatic Papers" }),
}
