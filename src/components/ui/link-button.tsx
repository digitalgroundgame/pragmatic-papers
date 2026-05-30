import { type ButtonProps, buttonVariants } from "@/components/ui/button"
import { cn } from "@/utilities/utils"

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
    <a className={cn(buttonVariants({ variant, size, className }))} {...props}>
      {children}
    </a>
  )
}

export { LinkButton }
