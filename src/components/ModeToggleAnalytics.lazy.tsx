"use client"

import React from "react"

import { LoadOnInteraction } from "@/components/LoadOnInteraction"
import { ModeToggleButton } from "@/components/ModeToggleButton"
import type { ModeToggleAnalytics } from "@/components/ModeToggleAnalytics"

type ModeToggleAnalyticsProps = React.ComponentProps<typeof ModeToggleAnalytics>

// The menu (base-ui's Menu and floating-ui) and the analytics call load when the reader
// reaches for the toggle, not with the page.
const load = () => import("@/components/ModeToggleAnalytics").then((m) => m.ModeToggleAnalytics)

/** `ModeToggleAnalytics`, as its button until the reader points at, focuses or clicks it. */
export function LazyModeToggle(props: ModeToggleAnalyticsProps): React.ReactNode {
  return (
    <LoadOnInteraction load={load} props={props}>
      <ModeToggleButton
        showLabel={props.showLabel}
        showFresh={props.showFresh}
        data-slot="dropdown-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={false}
      />
    </LoadOnInteraction>
  )
}
