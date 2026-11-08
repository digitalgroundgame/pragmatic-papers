/** @jsxImportSource @/blocks/blockImages/svg */
import { CodeXml } from "lucide"

import {
  type BlockPicker,
  BRAND,
  BRAND_MID,
  BRAND_SOFT,
  INK,
  Line,
  TEXT_DARK,
} from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    <rect x={60} y={50} width={360} height={220} rx={16} fill={INK} />
    <circle cx={88} cy={76} r={7} fill={BRAND} />
    <circle cx={110} cy={76} r={7} fill={BRAND_MID} />
    <circle cx={132} cy={76} r={7} fill={BRAND_SOFT} />
    <Line x={88} y={110} w={64} fill={BRAND} />
    <Line x={162} y={110} w={130} fill={TEXT_DARK} />
    <Line x={112} y={138} w={150} fill={TEXT_DARK} />
    <Line x={112} y={166} w={84} fill={BRAND_MID} />
    <Line x={206} y={166} w={110} fill={TEXT_DARK} />
    <Line x={136} y={194} w={120} fill="#6b5a55" />
    <Line x={88} y={222} w={40} fill={TEXT_DARK} />
  </>
)

/** Its images in the block picker. */
export default { thumbnail, icon: CodeXml } satisfies BlockPicker
