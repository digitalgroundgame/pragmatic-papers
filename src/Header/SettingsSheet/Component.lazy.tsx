"use client"

import React from "react"

import { LoadOnInteraction } from "@/components/LoadOnInteraction"
import type { SettingsSheet } from "./Component"
import { SettingsButton } from "./SettingsButton"

type SettingsSheetProps = React.ComponentProps<typeof SettingsSheet>

// The sheet (base-ui's Dialog) and its mode toggle load when the reader reaches for the button.
const load = () => import("./Component").then((m) => m.SettingsSheet)

/** `SettingsSheet`, as its button until the reader points at, focuses or clicks it. */
export function LazySettingsSheet(props: SettingsSheetProps): React.ReactNode {
  return (
    <LoadOnInteraction load={load} props={props}>
      <SettingsButton aria-haspopup="dialog" aria-expanded={false} />
    </LoadOnInteraction>
  )
}
