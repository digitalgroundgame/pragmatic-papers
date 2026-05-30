import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/utilities/utils"
import { MediaBlock, type StyledMediaBlockProps } from "./Component"

export type LightboxMediaBlockProps = StyledMediaBlockProps & {
  containerClassName?: string
}

export const LightboxMediaBlock: React.FC<LightboxMediaBlockProps> = ({
  containerClassName,
  className,
  media,
  ...props
}) => {
  if (typeof media === "number" || !media) return null

  return (
    <Dialog>
      <DialogTrigger className={cn("w-full cursor-pointer", containerClassName)}>
        <MediaBlock
          media={media}
          enableGutter={false}
          className={className}
          disableInnerContainer
          {...props}
        />
      </DialogTrigger>
      <DialogContent
        className="[&>button]:bg-background max-h-[90dvh] overflow-hidden rounded-none bg-transparent p-0 text-base shadow-none ring-0 sm:max-w-max [&>button]:top-2 [&>button]:right-2 [&>button]:rounded-sm [&>button]:p-0.5 [&>button_svg]:size-6"
        style={{
          maxWidth: `min(calc(100vw - 2rem), calc(80dvh * ${media.width ?? 1} / ${media.height ?? 1}))`,
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{media.filename}</DialogTitle>
        </DialogHeader>
        <MediaBlock
          media={media}
          sizes="100vw"
          variant="xlarge"
          enableGutter={false}
          className="text-muted-foreground [&_a]:text-foreground"
          imgClassName="border max-h-[80dvh] w-full h-auto"
          captionClassName="max-h-24 overflow-y-auto px-4"
          disableInnerContainer
        />
      </DialogContent>
    </Dialog>
  )
}
