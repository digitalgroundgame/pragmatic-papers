/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from "@payload-config"
import "@payloadcms/next/css"
import { handleServerFunctions, RootLayout } from "@payloadcms/next/layouts"
import type { ServerFunctionClient } from "payload"
import React from "react"

import { sentryHtmlAttributes } from "@/sentryConfig"

import { importMap } from "./admin/importMap.js"
import "./custom.scss"

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type Args = {
  children: React.ReactNode
}

const serverFunction: ServerFunctionClient = async function (args) {
  "use server"
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const Layout = ({ children }: Args) => (
  // Edited by hand despite the header above: it comes from Payload's project template, and
  // no Payload command run here rewrites it (generate:importmap writes admin/importMap.js).
  // Keep htmlProps if the template is ever copied over again: it carries the Sentry config
  // the browser SDK reads (src/sentryConfig.ts).
  <RootLayout
    config={config}
    htmlProps={sentryHtmlAttributes()}
    importMap={importMap}
    serverFunction={serverFunction}
  >
    {children}
  </RootLayout>
)

export default Layout
