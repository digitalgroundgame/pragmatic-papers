import { CMSLink } from "@/components/Link"
import { type ButtonProps, buttonVariants } from "@/components/ui/button"
import type { LinkField } from "@/payload-types"
import { cn } from "@/utilities/utils"

/** Props for a CMS-driven button that renders as a link; extends anchor props since the underlying element is <a>. */
interface CMSButtonProps extends React.ComponentProps<"a"> {
  link?: LinkField // Eventually replace with ButtonField when it's actually generated in payload-types.ts
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
}

/**
 * Renders a CMS button based on provided `button` data.
 * Supports different button variants and colors.
 */
export const CMSButton: React.FC<CMSButtonProps> = ({
  className,
  children,
  link,
  variant,
  size,
  ...props
}) => {
  return (
    <CMSLink
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      link={link}
      {...props}
    >
      {children}
    </CMSLink>
  )
}
