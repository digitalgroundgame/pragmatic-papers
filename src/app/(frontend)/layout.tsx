import { AdminBar, AdminBarHint } from "@/components/AdminBar"
import { Footer } from "@/Footer/Component"
import { Header } from "@/Header/Component"
import { sentryHtmlAttributes } from "@/sentryConfig"
import { getSiteURL } from "@/utilities/getURL"
import { DEFAULT_DESCRIPTION, mergeOpenGraph } from "@/utilities/mergeOpenGraph"
import { GoogleAnalytics } from "@/components/GoogleAnalytics.lazy"
import { ThemeProvider } from "@wrksz/themes/next"
import type { Metadata } from "next"
import React from "react"
import { FEEDS } from "./feeds/feeds"
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
      {...sentryHtmlAttributes()}
    >
      <head>
        <AdminBarHint />
        <link href="/manifest.json" rel="manifest" />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <link href="/apple-touch-icon.png" rel="apple-touch-icon" sizes="180x180" />
      </head>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AdminBar />
          <Header />
          <main role="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
      {process.env.GOOGLE_ANALYTICS_ID ? (
        <GoogleAnalytics gaId={process.env.GOOGLE_ANALYTICS_ID} />
      ) : null}
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getSiteURL()),
  description: DEFAULT_DESCRIPTION,
  openGraph: mergeOpenGraph(),
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    types: {
      "application/rss+xml": FEEDS.flatMap((feed) =>
        "headTitle" in feed ? [{ url: feed.path, title: feed.headTitle }] : [],
      ),
    },
  },
}
