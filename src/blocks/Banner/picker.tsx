/** @jsxImportSource @/blocks/blockImages/svg */
import { Info } from "lucide"

import {
  type BlockPicker,
  BRAND,
  BRAND_SOFT,
  BRAND_WASH,
  Heading,
  Line,
  PAPER,
  Paragraph,
} from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    <Paragraph x={60} y={44} widths={[360, 300]} />
    <rect x={60} y={100} width={360} height={120} rx={16} fill={BRAND_WASH} />
    <rect x={60} y={100} width={10} height={120} rx={5} fill={BRAND} />
    <circle cx={110} cy={140} r={18} fill={BRAND} />
    <rect x={107} y={136} width={6} height={16} rx={3} fill={PAPER} />
    <circle cx={110} cy={129} r={3.5} fill={PAPER} />
    <Heading x={142} y={131} w={180} />
    <Line x={142} y={166} w={250} fill={BRAND_SOFT} />
    <Line x={142} y={190} w={190} fill={BRAND_SOFT} />
    <Paragraph x={60} y={248} widths={[340, 260]} />
  </>
)

/** Its images in the block picker. */
export default { thumbnail, icon: Info } satisfies BlockPicker
