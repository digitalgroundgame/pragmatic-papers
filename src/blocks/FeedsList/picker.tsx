/** @jsxImportSource @/blocks/blockImages/svg */
import { Rss } from "lucide"

import {
  type BlockPicker,
  Glyph,
  BRAND,
  Card,
  Line,
  PAPER,
  TEXT_DARK,
} from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    {[44, 124, 204].map((y) => (
      <Card key={y} x={60} y={y} w={360} h={68}>
        <rect x={76} y={y + 14} width={40} height={40} rx={10} fill={BRAND} />
        <Glyph icon={Rss} x={83} y={y + 21} size={26} color={PAPER} strokeWidth={2.75} />
        <Line x={132} y={y + 18} w={150} fill={TEXT_DARK} />
        <Line x={132} y={y + 38} w={250} />
      </Card>
    ))}
  </>
)

/** Its images in the block picker. */
export default { thumbnail, icon: Rss } satisfies BlockPicker
