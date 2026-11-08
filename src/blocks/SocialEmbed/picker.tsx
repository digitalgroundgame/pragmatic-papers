/** @jsxImportSource @/blocks/blockImages/svg */
import { MessageCircle, Share2, Video } from "lucide"

import {
  Avatar,
  type BlockPicker,
  BRAND,
  BRAND_WASH,
  Card,
  Glyph,
  INK,
  Line,
  PAPER,
  Picture,
  SANS,
} from "@/blocks/blockImages/shapes"

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
      <Glyph icon={Share2} x={334} y={52} size={30} color={BRAND} strokeWidth={2.25} />
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

/** Its images in the block picker. */
export const socialEmbedPicker: BlockPicker = { thumbnail: <SocialPost />, icon: Share2 }

/** The legacy per-platform embeds, kept so old articles still load. */
export const legacyEmbedPickers = {
  blueSkyEmbed: { thumbnail: <SocialPost platform="Bluesky" />, icon: MessageCircle },
  redditEmbed: { thumbnail: <SocialPost platform="Reddit" />, icon: MessageCircle },
  tiktokEmbed: { thumbnail: <SocialPost platform="TikTok" video />, icon: Video },
  twitterEmbed: { thumbnail: <SocialPost platform="Twitter" />, icon: MessageCircle },
  youtubeEmbed: { thumbnail: <SocialPost platform="YouTube" video />, icon: Video },
} satisfies Record<string, BlockPicker>

export type LegacyEmbedSlug = keyof typeof legacyEmbedPickers
