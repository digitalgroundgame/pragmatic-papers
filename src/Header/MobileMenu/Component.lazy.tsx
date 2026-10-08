"use client"

import React from "react"

import { LoadOnInteraction } from "@/components/LoadOnInteraction"
import type { MobileMenu } from "./Component"
import { MenuButton } from "./MenuButton"

type MobileMenuProps = React.ComponentProps<typeof MobileMenu>

// The sheet (base-ui's Dialog) loads when the reader reaches for the menu button.
const load = () => import("./Component").then((m) => m.MobileMenu)

/** `MobileMenu`, as its button until the reader points at, focuses or clicks it. */
export function LazyMobileMenu(props: MobileMenuProps): React.ReactNode {
  return (
    <LoadOnInteraction load={load} props={props}>
      <MenuButton aria-haspopup="dialog" aria-expanded={false} />
    </LoadOnInteraction>
  )
}
