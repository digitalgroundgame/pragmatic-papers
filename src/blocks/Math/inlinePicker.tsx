/** @jsxImportSource @/blocks/blockImages/svg */
import { Radical } from "lucide"

import {
  type BlockPicker,
  BRAND,
  BRAND_WASH,
  Line,
  Paragraph,
  SERIF,
} from "@/blocks/blockImages/shapes"

const inlineMathThumbnail = (
  <>
    <Paragraph x={60} y={60} widths={[360, 330]} />
    <Line x={60} y={128} w={120} />
    <rect x={190} y={114} width={120} height={40} rx={10} fill={BRAND_WASH} />
    <text
      x={250}
      y={143}
      textAnchor="middle"
      fontFamily={SERIF}
      fontStyle="italic"
      fontSize={28}
      fill={BRAND}
    >
      x² + y²
    </text>
    <Line x={320} y={128} w={100} />
    <Paragraph x={60} y={180} widths={[360, 290, 340]} />
  </>
)

/** Its images in the block picker. */
export default { thumbnail: inlineMathThumbnail, icon: Radical } satisfies BlockPicker
