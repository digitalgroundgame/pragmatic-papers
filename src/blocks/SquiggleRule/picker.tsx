/** @jsxImportSource @/blocks/blockImages/svg */
import { Waves } from "lucide"

import { type BlockPicker, BRAND, Paragraph } from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    <Paragraph x={60} y={48} widths={[360, 320, 340]} />
    <path
      d="M120 160 c20 0 20 -16 40 -16 s20 16 40 16 s20 -16 40 -16 s20 16 40 16 s20 -16 40 -16 s20 16 40 16"
      stroke={BRAND}
      strokeWidth={6}
      strokeLinecap="round"
      fill="none"
    />
    <Paragraph x={60} y={212} widths={[350, 300, 230]} />
  </>
)

/** Its images in the block picker. */
export const squiggleRulePicker: BlockPicker = { thumbnail, icon: Waves }
