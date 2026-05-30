import type { FootnoteBlock } from "@/payload-types"
import React from "react"

import { FootnoteLabelClient } from "./FootnoteLabelClient"

interface FootnoteLabelProps {
  siblingData?: Partial<FootnoteBlock> | null
}

export const FootnoteLabel: React.FC<FootnoteLabelProps> = ({ siblingData }) => {
  return <FootnoteLabelClient siblingData={siblingData} />
}
