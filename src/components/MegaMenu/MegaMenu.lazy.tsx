"use client"

import React from "react"

import { LoadOnInteraction } from "@/components/LoadOnInteraction"
import type { InteractiveMegaMenu } from "./Interactive"

type InteractiveMegaMenuProps = React.ComponentProps<typeof InteractiveMegaMenu>

// base-ui's NavigationMenu and floating-ui load when the reader reaches for the menu.
const load = () => import("./Interactive").then((m) => m.InteractiveMegaMenu)

/** `InteractiveMegaMenu`, as `children` (the same links, in its markup) until first use. */
export function LazyMegaMenu({
  children,
  ...props
}: InteractiveMegaMenuProps & { children: React.ReactNode }): React.ReactNode {
  return (
    <LoadOnInteraction load={load} props={props}>
      {children}
    </LoadOnInteraction>
  )
}
