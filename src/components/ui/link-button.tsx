import { type ButtonProps, buttonVariants } from "@/components/ui/button"
import { cn } from "@/utilities/utils"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"

interface LinkButtonProps extends React.ComponentProps<"a"> {
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
}

const LinkButton: React.FC<LinkButtonProps> = ({
  children,
  variant,
  className,
  size,
  ...props
}) => {
  return (
    <HoverPrefetchLink
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </HoverPrefetchLink>
  )
}

export { LinkButton }
