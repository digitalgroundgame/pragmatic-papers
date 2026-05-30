import { CMSLink } from "@/components/Link/CMSLink2"
import type { LinkField } from "@/payload-types"
import { cn } from "@/utilities/utils"

interface CopyrightProps {
  copyright?: LinkField | null
  className?: string
}

export const Copyright: React.FC<CopyrightProps> = ({ className, copyright }) => {
  if (!copyright) return null
  return (
    <CMSLink
      link={copyright}
      className={cn("text-sm underline-offset-4 hover:underline", className)}
    >
      &copy; {new Date().getFullYear()} {copyright?.label}
    </CMSLink>
  )
}
