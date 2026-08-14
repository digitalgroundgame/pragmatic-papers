"use client"

import type { MerchBlock } from "@/payload-types"
import { type RowLabelProps, useRowLabel } from "@payloadcms/ui"
import React from "react"

/**
 * Names a collapsed Merch block by its heading.
 *
 * A page can carry several of these — a full-width one in the body, a square
 * one beside a rich-text column — and collapsed they'd otherwise all read
 * "Merch", leaving the editor to open each in turn to find the right one.
 *
 * Falls back to the block's own name where there's no heading, which is a
 * supported choice rather than an omission.
 */
export const MerchBlockLabel: React.FC<RowLabelProps> = () => {
  const { data } = useRowLabel<MerchBlock>()
  const heading = data?.heading?.trim()

  return <div>{heading ? `Merch: ${heading}` : "Merch"}</div>
}
