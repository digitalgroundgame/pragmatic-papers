import { Superscript } from "lucide-react"

import {
  type BlockPicker,
  BRAND,
  BRAND_WASH,
  Line,
  Paragraph,
  SANS,
  TEXT,
  TEXT_DARK,
} from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    <Paragraph x={60} y={52} widths={[360, 300]} />
    <rect x={366} y={68} width={22} height={24} rx={6} fill={BRAND_WASH} />
    <text
      x={377}
      y={86}
      textAnchor="middle"
      fontFamily={SANS}
      fontWeight={700}
      fontSize={17}
      fill={BRAND}
    >
      1
    </text>
    <Paragraph x={60} y={100} widths={[340, 210]} />
    <rect x={60} y={172} width={120} height={4} rx={2} fill={TEXT} />
    <text x={60} y={218} fontFamily={SANS} fontWeight={700} fontSize={20} fill={BRAND}>
      1.
    </text>
    <Line x={88} y={204} w={290} fill={TEXT_DARK} />
    <Line x={88} y={228} w={200} />
    <text x={60} y={274} fontFamily={SANS} fontWeight={700} fontSize={20} fill={TEXT}>
      2.
    </text>
    <Line x={88} y={260} w={240} />
  </>
)

/** Its images in the block picker. */
export const footnotePicker: BlockPicker = { thumbnail, icon: Superscript }
