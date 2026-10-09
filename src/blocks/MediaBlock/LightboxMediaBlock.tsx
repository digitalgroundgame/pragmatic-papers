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
  // The dialog is as wide as the image can grow: the viewport's width less a margin, or the height left
  // under the caption (up to `max-h-24`, its margins and gap) at the image's aspect ratio, whichever
  // is smaller. The image fills that width, so the close button sits on its corner.
  const imageHeight = caption ? "100dvh - 9.5rem" : "100dvh - 2rem"
  const width = `min(100vw - 2rem, (${imageHeight}) * ${media.width ?? 1} / ${media.height ?? 1})`

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
        className="[&>button]:bg-background max-h-[calc(100dvh-2rem)] overflow-hidden rounded-none bg-transparent p-0 text-base shadow-none ring-0 sm:max-w-max [&>button]:top-2 [&>button]:right-2 [&>button]:rounded-sm [&>button]:p-0.5 [&>button_svg]:size-6"
        style={{ width, maxWidth: width }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{media.filename}</DialogTitle>
        </DialogHeader>
        <FullscreenMedia media={media} imgClassName="max-h-none w-full" />
      </DialogContent>
    </Dialog>
  )
}
