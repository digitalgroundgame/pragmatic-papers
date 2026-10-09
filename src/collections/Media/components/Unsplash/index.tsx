import React from "react"

import { integrationStatus, unsplash } from "@/integrations"

import { UnsplashPicker } from "./UnsplashPicker"

/** Media's upload control: "Search Unsplash", only where `UNSPLASH_ACCESS_KEY` is set. */
export function UnsplashControl(): React.ReactNode {
  return integrationStatus(unsplash).configured ? <UnsplashPicker /> : null
}
