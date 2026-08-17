"use client"

import type { MerchBlock } from "@/payload-types"
import { Pill, type RowLabelProps, useRowLabel } from "@payloadcms/ui"
import React from "react"

/** Payload's own base class for the blocks field, so the row looks native. */
const baseClass = "blocks-field"

/**
 * Names a collapsed Merch block by its heading.
 *
 * A page can carry several of these — a full-width one in the body, a square
 * one beside a rich-text column — and collapsed they'd otherwise all read
 * "Merch", leaving the editor to open each in turn to find the right one.
 *
 * A custom `Label` replaces the whole default header, not just its text: the
 * row number and the block-type pill come from the same fragment, so they're
 * reproduced here rather than lost. What it does replace is the block-name
 * field that normally sits there, which the heading now stands in for.
 */
export const MerchBlockLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<MerchBlock>()
  const heading = data?.heading?.trim()

  return (
    <>
      <span className={`${baseClass}__block-number`}>
        {String((rowNumber ?? 0) + 1).padStart(2, "0")}
      </span>
      <Pill
        className={`${baseClass}__block-pill ${baseClass}__block-pill-merch`}
        pillStyle="white"
        size="small"
      >
        Merch
      </Pill>
      {heading ? <span>{heading}</span> : null}
    </>
  )
}
