import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/utilities/utils"
import { isMedia } from "@/components/Media"
import {
  MediaBlockCaption,
  MediaBlockFrame,
  MediaBlockImage,
  type StyledMediaBlockProps,
} from "./Component"
import { FullscreenMedia } from "./FullscreenMedia"

export type LightboxMediaBlockProps = StyledMediaBlockProps & {
  containerClassName?: string
  /** Classes for the button that wraps the image and opens the lightbox. */
  triggerClassName?: string
}

export const LightboxMediaBlock: React.FC<LightboxMediaBlockProps> = ({
  breakout,
  captionClassName,
  className,
  containerClassName,
  disableInnerContainer = true,
  enableGutter = false,
  imgClassName,
  imgStyle,
  media,
  sizes,
  triggerClassName,
  variant,
}) => {
  if (!isMedia(media)) return null

  const { caption } = media

  return (
    <Dialog>
      <div className={cn("flow-root w-full", containerClassName)}>
        <MediaBlockFrame breakout={breakout} className={className} enableGutter={enableGutter}>
          <DialogTrigger className={cn("block w-full [&>*]:m-0", triggerClassName)}>
            <MediaBlockImage
              media={media}
              imgClassName={imgClassName}
              imgStyle={imgStyle}
              sizes={sizes}
              variant={variant}
            />
          </DialogTrigger>
          <MediaBlockCaption
            caption={caption}
            captionClassName={captionClassName}
            disableInnerContainer={disableInnerContainer}
          />
        </MediaBlockFrame>
      </div>
      <DialogContent
        className="[&>button]:bg-background max-h-[90dvh] w-max overflow-hidden rounded-none bg-transparent p-0 text-base shadow-none ring-0 sm:max-w-max [&>button]:top-2 [&>button]:right-2 [&>button]:rounded-sm [&>button]:p-0.5 [&>button_svg]:size-6"
        style={{
          maxWidth: `min(calc(100vw - 2rem), calc(80dvh * ${media.width ?? 1} / ${media.height ?? 1}))`,
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{media.filename}</DialogTitle>
        </DialogHeader>
        <FullscreenMedia media={media} />
      </DialogContent>
    </Dialog>
  )
}
