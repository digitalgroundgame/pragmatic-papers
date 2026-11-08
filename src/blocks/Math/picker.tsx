import { Radical, Sigma } from "lucide-react"

import {
  type BlockPicker,
  BRAND,
  BRAND_WASH,
  INK,
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

export const inlineMathPicker: BlockPicker = { thumbnail: inlineMathThumbnail, icon: Radical }

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

export const displayMathPicker: BlockPicker = { thumbnail: displayMathThumbnail, icon: Sigma }
