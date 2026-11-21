/** @jsxImportSource @/blocks/blockImages/svg */
import { Sigma } from "lucide"

import { type BlockPicker, BRAND_WASH, INK, Paragraph, SERIF } from "@/blocks/blockImages/shapes"

const displayMathThumbnail = (
  <>
    <Paragraph x={60} y={44} widths={[360, 300]} />
    <rect x={90} y={110} width={300} height={100} rx={16} fill={BRAND_WASH} />
    <text
      x={240}
      y={176}
      textAnchor="middle"
      fontFamily={SERIF}
      fontStyle="italic"
      fontSize={44}
      fill={INK}
    >
      a² + b² = c²
    </text>
    <Paragraph x={60} y={240} widths={[340, 220]} />
  </>
)

/** Its images in the block picker. */
export default { thumbnail: displayMathThumbnail, icon: Sigma } satisfies BlockPicker
