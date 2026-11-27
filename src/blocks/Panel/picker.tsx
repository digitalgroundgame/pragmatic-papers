/** @jsxImportSource @/blocks/blockImages/svg */
import { PanelRight } from "lucide"

import { type BlockPicker, BRAND, Card, Line, TEXT_DARK } from "@/blocks/blockImages/shapes"

const thumbnail = (
  <>
    <Card x={40} y={40} w={250} h={240}>
      <Line x={60} y={64} w={160} fill={TEXT_DARK} />
      {[96, 126, 156, 186, 216].map((y) => (
        <Line key={y} x={60} y={y} w={200} />
      ))}
    </Card>
    <Card x={310} y={40} w={130} h={240}>
      <rect x={326} y={60} width={60} height={6} rx={3} fill={BRAND} />
      {[84, 112, 140, 168].map((y) => (
        <Line key={y} x={326} y={y} w={96} />
      ))}
    </Card>
  </>
)

/** Its images in the block picker: a column of text with a narrow panel beside it. */
export default { thumbnail, icon: PanelRight } satisfies BlockPicker
