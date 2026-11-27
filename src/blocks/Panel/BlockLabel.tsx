"use client"

import type { PanelBlock } from "@/payload-types"
import { Pill, type RowLabelProps, useRowLabel } from "@payloadcms/ui"
import React from "react"

import { PANEL_SOURCES } from "./config"

/** Payload's own base class for the blocks field, so the row looks native. */
const baseClass = "blocks-field"

/**
 * Names a collapsed panel by what it lists, and the heading an editor gave it: an aside is a
 * column of Panel blocks, which would otherwise all read "Panel". Like any custom `Label`, it
 * replaces the whole header, so the row number and the pill are drawn here too.
 */
export const PanelBlockLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<PanelBlock>()
  const source = PANEL_SOURCES.find(({ value }) => value === data?.source)?.label
  const title = data?.title?.trim()

  return (
    <>
      <span className={`${baseClass}__block-number`}>
        {String((rowNumber ?? 0) + 1).padStart(2, "0")}
      </span>
      <Pill
        className={`${baseClass}__block-pill ${baseClass}__block-pill-panel`}
        pillStyle="white"
        size="small"
      >
        Panel
      </Pill>
      {source ? <span>{title ? `${title} (${source})` : source}</span> : null}
    </>
  )
}
