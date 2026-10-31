import {
  BookOpen,
  ClipboardList,
  CodeXml,
  Columns2,
  GitCommitVertical,
  Image as ImageIcon,
  Info,
  LayoutDashboard,
  LayoutGrid,
  Mail,
  Map as MapIcon,
  Megaphone,
  MessageCircle,
  Radical,
  Rss,
  Share2,
  Shirt,
  Sigma,
  Superscript,
  Users,
  Video,
  Waves,
  type LucideIcon,
} from "lucide-react"
import type { ReactElement, ReactNode } from "react"

/**
 * The art behind every block's picker images (see `./index.ts`). Thumbnails are a
 * sketch of what the block puts on the page, on one 480×320 rounded card in the
 * brand's orange and warm greys; icons are a Lucide glyph in the brand orange.
 * `pnpm block-images` renders them to `public/block-images/`.
 */

export const THUMBNAIL_WIDTH = 480
export const THUMBNAIL_HEIGHT = 320
export const ICON_SIZE = 24

export const BRAND = "#ff401a"
const BRAND_MID = "#ff8466"
const BRAND_SOFT = "#ffc9bb"
const BRAND_WASH = "#ffe6de"
const BACKDROP = "#fff3ef"
const PAPER = "#ffffff"
const EDGE = "#f1d8cf"
const INK = "#2a211e"
const TEXT = "#d9c7c0"
const TEXT_DARK = "#8f7c76"
const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
const SERIF = "Georgia, 'Times New Roman', serif"

// --- Shapes every thumbnail draws with ---------------------------------------

/** A line of body text. */
const Line = ({ x, y, w, fill = TEXT }: { x: number; y: number; w: number; fill?: string }) => (
  <rect x={x} y={y} width={w} height={12} rx={6} fill={fill} />
)

/** A heading. */
const Heading = ({ x, y, w, h = 18 }: { x: number; y: number; w: number; h?: number }) => (
  <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={INK} />
)

/** A paragraph: lines of the given widths, 24px apart. */
const Paragraph = ({ x, y, widths }: { x: number; y: number; widths: number[] }) => (
  <>
    {widths.map((w, i) => (
      <Line key={i} x={x} y={y + i * 24} w={w} />
    ))}
  </>
)

const Card = ({
  x,
  y,
  w,
  h,
  fill = PAPER,
  children,
}: {
  x: number
  y: number
  w: number
  h: number
  fill?: string
  children?: ReactNode
}) => (
  <>
    <rect x={x} y={y} width={w} height={h} rx={16} fill={fill} stroke={EDGE} strokeWidth={2} />
    {children}
  </>
)

const Button = ({ x, y, w, h = 36 }: { x: number; y: number; w: number; h?: number }) => (
  <>
    <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={BRAND} />
    <rect x={x + w / 2 - w / 4} y={y + h / 2 - 4} width={w / 2} height={8} rx={4} fill={PAPER} />
  </>
)

const Input = ({ x, y, w, h = 36 }: { x: number; y: number; w: number; h?: number }) => (
  <rect x={x} y={y} width={w} height={h} rx={10} fill={PAPER} stroke={TEXT} strokeWidth={2} />
)

/** A photo: a sun over two hills, clipped to a rounded frame. `id` must be unique in its SVG. */
const Picture = ({
  id,
  x,
  y,
  w,
  h,
}: {
  id: string
  x: number
  y: number
  w: number
  h: number
}) => (
  <>
    <defs>
      <clipPath id={id}>
        <rect x={x} y={y} width={w} height={h} rx={12} />
      </clipPath>
    </defs>
    <g clipPath={`url(#${id})`}>
      <rect x={x} y={y} width={w} height={h} fill={BRAND_SOFT} />
      <circle cx={x + w * 0.74} cy={y + h * 0.3} r={Math.min(w, h) * 0.12} fill={PAPER} />
      <path
        d={`M${x} ${y + h} L${x} ${y + h * 0.7} L${x + w * 0.32} ${y + h * 0.38} L${x + w * 0.62} ${y + h} Z`}
        fill={BRAND_MID}
      />
      <path
        d={`M${x + w * 0.3} ${y + h} L${x + w * 0.66} ${y + h * 0.5} L${x + w} ${y + h * 0.82} L${x + w} ${y + h} Z`}
        fill={BRAND}
      />
    </g>
  </>
)

const Avatar = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
  <>
    <circle cx={cx} cy={cy} r={r} fill={BRAND_SOFT} />
    <circle cx={cx} cy={cy - r * 0.2} r={r * 0.36} fill={BRAND_MID} />
    <path
      d={`M${cx - r * 0.62} ${cy + r * 0.78} a${r * 0.62} ${r * 0.5} 0 0 1 ${r * 1.24} 0`}
      fill={BRAND_MID}
    />
  </>
)

// --- One thumbnail per block --------------------------------------------------

const banner = (
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

const cta = (
  <Card x={60} y={56} w={360} h={208}>
    <Heading x={92} y={88} w={240} h={22} />
    <Line x={92} y={130} w={296} />
    <Line x={92} y={154} w={230} />
    <Button x={92} y={196} w={140} h={40} />
    <path
      d="M252 216 h28 m-10 -10 l10 10 l-10 10"
      stroke={BRAND}
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Card>
)

const code = (
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

const collectionGrid = (
  <>
    {[0, 1].flatMap((row) =>
      [0, 1, 2].map((col) => {
        const x = 44 + col * 136
        const y = 36 + row * 128
        return (
          <Card key={`${row}-${col}`} x={x} y={y} w={120} h={116}>
            <Picture id={`grid-${row}-${col}`} x={x + 8} y={y + 8} w={104} h={60} />
            <Line x={x + 10} y={y + 78} w={92} fill={TEXT_DARK} />
            <Line x={x + 10} y={y + 96} w={60} />
          </Card>
        )
      }),
    )}
  </>
)

const content = (
  <>
    <Heading x={60} y={50} w={220} h={22} />
    <Paragraph x={60} y={96} widths={[170, 160, 170, 120, 170, 150]} />
    <Paragraph x={250} y={96} widths={[170, 170, 140, 170, 160, 90]} />
    <Line x={250} y={144} w={90} fill={BRAND} />
  </>
)

const contributors = (
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

const feedsList = (
  <>
    {[44, 124, 204].map((y) => (
      <Card key={y} x={60} y={y} w={360} h={68}>
        <rect x={76} y={y + 14} width={40} height={40} rx={10} fill={BRAND} />
        <circle cx={88} cy={y + 42} r={3.5} fill={PAPER} />
        <path
          d={`M84 ${y + 31} a11 11 0 0 1 11 11 M84 ${y + 22} a20 20 0 0 1 20 20`}
          stroke={PAPER}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        <Line x={132} y={y + 18} w={150} fill={TEXT_DARK} />
        <Line x={132} y={y + 38} w={250} />
      </Card>
    ))}
  </>
)

const footnote = (
  <>
    <Paragraph x={60} y={52} widths={[360, 300]} />
    <rect x={366} y={68} width={22} height={24} rx={6} fill={BRAND_WASH} />
    <text
      x={377}
      y={86}
      textAnchor="middle"
      fontFamily={SANS}
      fontWeight={700}
      fontSize={17}
      fill={BRAND}
    >
      1
    </text>
    <Paragraph x={60} y={100} widths={[340, 210]} />
    <rect x={60} y={172} width={120} height={4} rx={2} fill={TEXT} />
    <text x={60} y={218} fontFamily={SANS} fontWeight={700} fontSize={20} fill={BRAND}>
      1.
    </text>
    <Line x={88} y={204} w={290} fill={TEXT_DARK} />
    <Line x={88} y={228} w={200} />
    <text x={60} y={274} fontFamily={SANS} fontWeight={700} fontSize={20} fill={TEXT}>
      2.
    </text>
    <Line x={88} y={260} w={240} />
  </>
)

const formBlock = (
  <Card x={80} y={36} w={320} h={248}>
    <Line x={108} y={62} w={80} fill={TEXT_DARK} />
    <Input x={108} y={82} w={264} />
    <Line x={108} y={136} w={110} fill={TEXT_DARK} />
    <Input x={108} y={156} w={264} />
    <Button x={108} y={220} w={124} h={40} />
  </Card>
)

/** Rows of the tile map, by shade: 0 is no region, 1–5 run from light to the brand color. */
const MAP_TILES = [
  [0, 2, 3, 0, 0, 4, 0],
  [1, 3, 5, 4, 2, 5, 3],
  [2, 4, 1, 2, 5, 3, 0],
  [0, 1, 3, 5, 4, 0, 0],
]
const MAP_SHADES = ["", "#f3e5e0", BRAND_WASH, BRAND_SOFT, BRAND_MID, BRAND]

const interactiveMap = (
  <>
    {MAP_TILES.flatMap((row, r) =>
      row.map((shade, c) =>
        shade === 0 ? null : (
          <rect
            key={`${r}-${c}`}
            x={74 + c * 48}
            y={36 + r * 48}
            width={42}
            height={42}
            rx={10}
            fill={MAP_SHADES[shade]}
          />
        ),
      ),
    )}
    {[1, 2, 3, 4, 5].map((shade, i) => (
      <rect
        key={shade}
        x={140 + i * 42}
        y={244}
        width={38}
        height={14}
        rx={4}
        fill={MAP_SHADES[shade]}
      />
    ))}
    <Line x={140} y={270} w={40} />
    <Line x={306} y={270} w={40} />
    <Card x={300} y={150} w={120} h={56}>
      <Line x={314} y={164} w={70} fill={INK} />
      <Line x={314} y={184} w={92} fill={BRAND} />
    </Card>
  </>
)

const inlineMathBlock = (
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

const displayMathBlock = (
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

const mediaBlock = (
  <>
    <Picture id="media" x={60} y={36} w={360} h={208} />
    <Line x={150} y={260} w={180} fill={TEXT_DARK} />
    <Line x={180} y={282} w={120} />
  </>
)

const mediaCollage = (
  <>
    <Picture id="collage-1" x={60} y={40} w={216} h={240} />
    <Picture id="collage-2" x={288} y={40} w={132} h={114} />
    <Picture id="collage-3" x={288} y={166} w={132} h={114} />
  </>
)

const merch = (
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

const newsletterSignup = (
  <Card x={60} y={60} w={360} h={200}>
    <rect x={88} y={88} width={60} height={44} rx={8} fill={BRAND} />
    <path
      d="M94 96 L118 114 L142 96"
      stroke={PAPER}
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Heading x={168} y={92} w={200} />
    <Line x={168} y={120} w={150} />
    <Input x={88} y={176} w={204} h={44} />
    <Line x={104} y={192} w={100} />
    <Button x={304} y={176} w={88} h={44} />
  </Card>
)

const SocialPost = ({ platform, video = false }: { platform?: string; video?: boolean }) => (
  <Card x={100} y={28} w={280} h={264}>
    <Avatar cx={140} cy={68} r={20} />
    <Line x={170} y={54} w={96} fill={INK} />
    <Line x={170} y={74} w={64} />
    {platform ? (
      <>
        <rect x={270} y={50} width={94} height={28} rx={14} fill={BRAND_WASH} />
        <text
          x={317}
          y={69}
          textAnchor="middle"
          fontFamily={SANS}
          fontWeight={700}
          fontSize={14}
          fill={BRAND}
        >
          {platform}
        </text>
      </>
    ) : (
      <Share2 x={334} y={52} width={30} height={30} color={BRAND} strokeWidth={2.25} />
    )}
    <Line x={120} y={106} w={240} />
    <Line x={120} y={128} w={200} />
    <Picture id="post" x={120} y={152} w={240} h={video ? 116 : 92} />
    {video ? (
      <>
        <circle cx={240} cy={210} r={24} fill={INK} fillOpacity={0.85} />
        <path d="M232 198 L252 210 L232 222 Z" fill={PAPER} />
      </>
    ) : (
      <>
        <Line x={120} y={260} w={40} />
        <Line x={176} y={260} w={40} />
        <Line x={232} y={260} w={40} />
      </>
    )}
  </Card>
)

const squiggleRule = (
  <>
    <Paragraph x={60} y={48} widths={[360, 320, 340]} />
    <path
      d="M120 160 c20 0 20 -16 40 -16 s20 16 40 16 s20 -16 40 -16 s20 16 40 16 s20 -16 40 -16 s20 16 40 16"
      stroke={BRAND}
      strokeWidth={6}
      strokeLinecap="round"
      fill="none"
    />
    <Paragraph x={60} y={212} widths={[350, 300, 230]} />
  </>
)

const timeline = (
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

const volumeView = (
  <>
    <text
      x={60}
      y={66}
      fontFamily={SANS}
      fontWeight={800}
      fontSize={22}
      letterSpacing={2}
      fill={BRAND}
    >
      VOL. IV
    </text>
    <Heading x={60} y={80} w={240} h={22} />
    {[124, 180, 236].map((y, i) => (
      <g key={y}>
        <Picture id={`volume-${i}`} x={60} y={y} w={76} h={46} />
        <Line x={152} y={y + 6} w={200} fill={TEXT_DARK} />
        <Line x={152} y={y + 26} w={140} />
      </g>
    ))}
  </>
)

// --- The catalogue -----------------------------------------------------------

export interface BlockArt {
  /** What the thumbnail draws inside its 480×320 card. */
  thumbnail: ReactElement
  /** The Lucide glyph drawn as the block's icon. */
  icon: LucideIcon
}

/** Every block's art, by slug. A block's config reads its images with `blockImages(slug)`. */
export const BLOCK_ART: Record<string, BlockArt> = {
  banner: { thumbnail: banner, icon: Info },
  cta: { thumbnail: cta, icon: Megaphone },
  code: { thumbnail: code, icon: CodeXml },
  collectionGrid: { thumbnail: collectionGrid, icon: LayoutGrid },
  content: { thumbnail: content, icon: Columns2 },
  contributors: { thumbnail: contributors, icon: Users },
  feedsList: { thumbnail: feedsList, icon: Rss },
  footnote: { thumbnail: footnote, icon: Superscript },
  formBlock: { thumbnail: formBlock, icon: ClipboardList },
  interactiveMap: { thumbnail: interactiveMap, icon: MapIcon },
  inlineMathBlock: { thumbnail: inlineMathBlock, icon: Radical },
  displayMathBlock: { thumbnail: displayMathBlock, icon: Sigma },
  mediaBlock: { thumbnail: mediaBlock, icon: ImageIcon },
  mediaCollage: { thumbnail: mediaCollage, icon: LayoutDashboard },
  merch: { thumbnail: merch, icon: Shirt },
  newsletterSignup: { thumbnail: newsletterSignup, icon: Mail },
  socialEmbed: { thumbnail: <SocialPost />, icon: Share2 },
  squiggleRule: { thumbnail: squiggleRule, icon: Waves },
  timeline: { thumbnail: timeline, icon: GitCommitVertical },
  volumeView: { thumbnail: volumeView, icon: BookOpen },
  // The legacy embeds, kept so old articles still load; Social Embed replaced them.
  blueSkyEmbed: { thumbnail: <SocialPost platform="Bluesky" />, icon: MessageCircle },
  redditEmbed: { thumbnail: <SocialPost platform="Reddit" />, icon: MessageCircle },
  tiktokEmbed: { thumbnail: <SocialPost platform="TikTok" video />, icon: Video },
  twitterEmbed: { thumbnail: <SocialPost platform="Twitter" />, icon: MessageCircle },
  youtubeEmbed: { thumbnail: <SocialPost platform="YouTube" video />, icon: Video },
}

export const Thumbnail = ({ art }: { art: BlockArt }): ReactElement => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox={`0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}`}
    width={THUMBNAIL_WIDTH}
    height={THUMBNAIL_HEIGHT}
    fill="none"
  >
    <rect width={THUMBNAIL_WIDTH} height={THUMBNAIL_HEIGHT} rx={24} fill={BACKDROP} />
    {art.thumbnail}
  </svg>
)

export const Icon = ({ art }: { art: BlockArt }): ReactElement => {
  const Glyph = art.icon
  return (
    <Glyph xmlns="http://www.w3.org/2000/svg" size={ICON_SIZE} color={BRAND} strokeWidth={2.25} />
  )
}
