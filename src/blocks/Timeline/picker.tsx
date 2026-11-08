/** @jsxImportSource @/blocks/blockImages/svg */
import { GitCommitVertical } from "lucide"

import {
  type BlockPicker,
  BRAND,
  BRAND_WASH,
  INK,
  Line,
  PAPER,
  TEXT,
} from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    <rect x={106} y={56} width={6} height={212} rx={3} fill={TEXT} />
    {[64, 144, 224].map((y, i) => (
      <g key={y}>
        <circle
          cx={109}
          cy={y + 12}
          r={12}
          fill={i === 0 ? BRAND : PAPER}
          stroke={BRAND}
          strokeWidth={5}
        />
        <rect x={136} y={y} width={76} height={24} rx={12} fill={BRAND_WASH} />
        <Line x={148} y={y + 6} w={52} fill={BRAND} />
        <Line x={224} y={y + 6} w={170} fill={INK} />
        <Line x={136} y={y + 36} w={250} />
      </g>
    ))}
  </>
)

/** Its images in the block picker. */
export const timelinePicker: BlockPicker = { thumbnail, icon: GitCommitVertical }
