"use client"

import dynamic from "next/dynamic"

// Imported statically, `@next/third-parties` would ship on every page whether or not
// GOOGLE_ANALYTICS_ID is set; this way only a site that renders it downloads it.
export const GoogleAnalytics = dynamic(() =>
  import("@next/third-parties/google").then((m) => m.GoogleAnalytics),
)
