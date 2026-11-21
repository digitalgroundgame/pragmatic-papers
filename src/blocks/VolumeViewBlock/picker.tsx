/** @jsxImportSource @/blocks/blockImages/svg */
import { BookOpen } from "lucide"

import {
  type BlockPicker,
  BRAND,
  Heading,
  Line,
  Picture,
  SANS,
  TEXT_DARK,
} from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    <text
      x={60}
      y={66}
      fontFamily={SANS}
      fontWeight={800}
      fontSize={22}
      letterSpacing={2}
      fill={BRAND}
    >
      VOL. IV
    </text>
    <Heading x={60} y={80} w={240} h={22} />
    {[124, 180, 236].map((y, i) => (
      <g key={y}>
        <Picture id={`volume-${i}`} x={60} y={y} w={76} h={46} />
        <Line x={152} y={y + 6} w={200} fill={TEXT_DARK} />
        <Line x={152} y={y + 26} w={140} />
      </g>
    ))}
  </>
)

/** Its images in the block picker. */
export default { thumbnail, icon: BookOpen } satisfies BlockPicker
