/** @jsxImportSource @/blocks/blockImages/svg */
import { Shirt } from "lucide"

import {
  type BlockPicker,
  BRAND,
  BRAND_MID,
  BRAND_WASH,
  Button,
  Card,
  Line,
  TEXT_DARK,
} from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    <Card x={70} y={36} w={160} h={248}>
      <rect x={82} y={48} width={136} height={124} rx={10} fill={BRAND_WASH} />
      <path
        d="M128 70 L110 78 L100 100 L116 108 L116 156 L184 156 L184 108 L200 100 L190 78 L172 70 Q150 84 128 70 Z"
        fill={BRAND}
      />
      <Line x={84} y={188} w={110} fill={TEXT_DARK} />
      <Line x={84} y={210} w={50} fill={BRAND} />
      <Button x={84} y={236} w={132} h={34} />
    </Card>
    <Card x={250} y={36} w={160} h={248}>
      <rect x={262} y={48} width={136} height={124} rx={10} fill={BRAND_WASH} />
      <path d="M310 92 v-10 a20 20 0 0 1 40 0 v10" stroke={BRAND_MID} strokeWidth={6} fill="none" />
      <rect x={292} y={92} width={76} height={66} rx={8} fill={BRAND_MID} />
      <Line x={264} y={188} w={100} fill={TEXT_DARK} />
      <Line x={264} y={210} w={50} fill={BRAND} />
      <Button x={264} y={236} w={132} h={34} />
    </Card>
  </>
)

/** Its images in the block picker. */
export const merchPicker: BlockPicker = { thumbnail, icon: Shirt }
