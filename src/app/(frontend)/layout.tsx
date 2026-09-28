import { AdminBar } from "@/components/AdminBar"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Footer } from "@/Footer/Component"
import { Header } from "@/Header/Component"
import { getServerSideURL } from "@/utilities/getURL"
import { DEFAULT_DESCRIPTION, mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import { GoogleAnalytics } from "@next/third-parties/google"
import { ThemeProvider } from "@wrksz/themes/next"
import type { Metadata } from "next"
import React from "react"
import { fontVariables } from "./fonts"
import "./globals.css"

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.ReactElement> {
  return (
    <html
      className={fontVariables}
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <head>
        <link href="/manifest.json" rel="manifest" />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <link href="/apple-touch-icon.png" rel="apple-touch-icon" sizes="180x180" />
      </head>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AdminBar />
          <Header />
          <main role="main" className="flex-1">
            <Breadcrumbs />
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
      <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID} />
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  description: DEFAULT_DESCRIPTION,
  openGraph: mergeOpenGraph(),
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    types: {
      "application/rss+xml": [
        { url: "/feed.articles", title: "Pragmatic Papers - Articles RSS Feed" },
        { url: "/feed.volumes", title: "Pragmatic Papers - Volumes RSS Feed" },
      ],
    },
  },
}
