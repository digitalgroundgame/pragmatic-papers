import { BannerBlock } from "@/blocks/Banner/Component"
import { CallToActionBlock } from "@/blocks/CallToAction/Component"
import { CodeBlock } from "@/blocks/Code/Component"
import { FootnoteBlock } from "@/blocks/Footnote/Component"
import { MathBlock, type MathBlockProps } from "@/blocks/Math/Component"
import { LightboxMediaBlock } from "@/blocks/MediaBlock/LightboxMediaBlock"
import { MediaCollageBlock } from "@/blocks/MediaCollageBlock/component"
import {
  BlueskyEmbedBlock,
  RedditEmbedBlock,
  SocialEmbedBlock,
  TikTokEmbedBlock,
  TwitterEmbedBlock,
  YouTubeEmbedBlock,
} from "@/blocks/SocialEmbed"
import type { ParentDocContext } from "@/blocks/SocialEmbed/types"
import { SquiggleRuleBlock } from "@/blocks/SquiggleRule/Component"
import { TimelineBlock } from "@/blocks/Timeline/Component"
import type {
  BannerBlock as BannerBlockProps,
  CodeBlock as CodeBlockProps,
  CallToActionBlock as CTABlockProps,
  FootnoteBlock as FootnoteBlockProps,
  MediaBlock as MediaBlockProps,
  MediaCollageBlock as MediaCollageBlockProps,
  SocialEmbedBlock as SocialEmbedBlockProps,
  SquiggleRuleBlock as SquiggleRuleBlockProps,
  TimelineBlock as TimelineBlockProps,
} from "@/payload-types"
import { cn } from "@/utilities/utils"
import type {
  DefaultNodeTypes,
  DefaultTypedEditorState,
  SerializedBlockNode,
  SerializedInlineBlockNode,
  SerializedLinkNode,
} from "@payloadcms/richtext-lexical"
import {
  RichText as ConvertRichText,
  type JSXConvertersFunction,
  LinkJSXConverter,
} from "@payloadcms/richtext-lexical/react"

type NodeTypes =
  | DefaultNodeTypes
  | SerializedBlockNode<
      | CTABlockProps
      | MediaBlockProps
      | MediaCollageBlockProps
      | BannerBlockProps
      | CodeBlockProps
      | MathBlockProps
      | SquiggleRuleBlockProps
      | SocialEmbedBlockProps
      | TimelineBlockProps
    >
  | SerializedInlineBlockNode<MathBlockProps | FootnoteBlockProps>

export const internalDocToHref = ({ linkNode }: { linkNode: SerializedLinkNode }): string => {
  const { value, relationTo } = linkNode.fields.doc!
  if (typeof value !== "object") {
    throw new Error("Expected value to be an object")
  }
  const slug = value.slug
  return relationTo === "articles" ? `/articles/${slug}` : `/${slug}`
}

function createJsxConverters(parentDoc?: ParentDocContext): JSXConvertersFunction<NodeTypes> {
  return ({ defaultConverters }) => ({
    ...defaultConverters,
    ...LinkJSXConverter({ internalDocToHref }),
    blocks: {
      banner: ({ node }) => <BannerBlock className="col-start-2 mb-4" {...node.fields} />,
      mediaBlock: ({ node }) => (
        <LightboxMediaBlock containerClassName="-my-8" breakout {...node.fields} />
      ),
      mediaCollage: ({ node }) => <MediaCollageBlock {...node.fields} />,
      code: ({ node }) => <CodeBlock className="col-start-2" {...node.fields} />,
      cta: ({ node }) => <CallToActionBlock {...node.fields} />,
      displayMathBlock: ({ node }: { node: SerializedBlockNode<MathBlockProps> }) => (
        <MathBlock {...node.fields} />
      ),
      squiggleRule: ({ node }) => <SquiggleRuleBlock className="col-start-2" {...node.fields} />,
      socialEmbed: ({ node }) => <SocialEmbedBlock {...node.fields} parentDoc={parentDoc} />,
      timeline: ({ node }: { node: SerializedBlockNode<TimelineBlockProps> }) => (
        <TimelineBlock className="col-start-2 my-8" {...node.fields} />
      ),
      // Legacy block types for backward compatibility with existing content
      twitterEmbed: ({ node }: { node: SerializedBlockNode<SocialEmbedBlockProps> }) => (
        <TwitterEmbedBlock {...node.fields} />
      ),
      youtubeEmbed: ({ node }: { node: SerializedBlockNode<SocialEmbedBlockProps> }) => (
        <YouTubeEmbedBlock {...node.fields} />
      ),
      redditEmbed: ({ node }: { node: SerializedBlockNode<SocialEmbedBlockProps> }) => (
        <RedditEmbedBlock {...node.fields} />
      ),
      blueSkyEmbed: ({ node }: { node: SerializedBlockNode<SocialEmbedBlockProps> }) => (
        <BlueskyEmbedBlock {...node.fields} />
      ),
      tiktokEmbed: ({ node }: { node: SerializedBlockNode<SocialEmbedBlockProps> }) => (
        <TikTokEmbedBlock {...node.fields} />
      ),
    },
    inlineBlocks: {
      inlineMathBlock: ({ node }: { node: SerializedInlineBlockNode<MathBlockProps> }) => (
        <MathBlock {...node.fields} />
      ),
      footnote: ({ node }) => <FootnoteBlock {...node.fields} />,
    },
  })
}

interface RichTextProps {
  className?: string
  data: DefaultTypedEditorState
  enableGutter?: boolean
  enableProse?: boolean
  parentDoc?: ParentDocContext
}

export default function RichText({
  className,
  enableProse = true,
  enableGutter = true,
  data,
  parentDoc,
}: RichTextProps): React.ReactNode {
  return (
    <ConvertRichText
      className={cn(
        "payload-richtext prose-lg md:prose-xl prose-brand md:prose-blockquote:-mx-4 lg:prose-blockquote:-mx-8 prose-p:leading-relaxed prose-h2:mt-9 prose-h2:mb-6 prose-h2:text-4xl md:prose-h2:text-5xl prose-h3:text-3xl md:prose-h3:text-4xl prose-h4:text-2xl md:prose-h4:text-3xl font-serif",
        enableGutter ? "container" : "max-w-none",
        enableProse && "prose",
        className,
      )}
      converters={createJsxConverters(parentDoc)}
      data={data}
    />
  )
}
