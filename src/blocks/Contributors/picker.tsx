/** @jsxImportSource @/blocks/blockImages/svg */
import { Users } from "lucide"

import { Avatar, type BlockPicker, Heading, Line, TEXT_DARK } from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    <Heading x={60} y={48} w={170} h={22} />
    {[0, 1, 2, 3].map((i) => {
      const cx = 105 + i * 90
      return (
        <g key={i}>
          <Avatar cx={cx} cy={150} r={36} />
          <Line x={cx - 34} y={204} w={68} fill={TEXT_DARK} />
          <Line x={cx - 24} y={226} w={48} />
        </g>
      )
    })}
  </>
)

/** Its images in the block picker. */
export default { thumbnail, icon: Users } satisfies BlockPicker
