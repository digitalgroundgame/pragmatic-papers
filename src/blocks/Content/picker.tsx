import { Columns2 } from "lucide-react"

import { type BlockPicker, BRAND, Heading, Line, Paragraph } from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    <Heading x={60} y={50} w={220} h={22} />
    <Paragraph x={60} y={96} widths={[170, 160, 170, 120, 170, 150]} />
    <Paragraph x={250} y={96} widths={[170, 170, 140, 170, 160, 90]} />
    <Line x={250} y={144} w={90} fill={BRAND} />
  </>
)

/** Its images in the block picker. */
export const contentPicker: BlockPicker = { thumbnail, icon: Columns2 }
