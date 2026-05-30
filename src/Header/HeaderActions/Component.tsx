import { CMSButton } from "@/components/Button"
import type { Header } from "@/payload-types"
import { cn } from "@/utilities/utils"

interface HeaderActionsProps extends React.ComponentProps<"div"> {
  actions?: Header["actions"]
}

export const HeaderActions: React.FC<HeaderActionsProps> = ({ actions, className, ...props }) => {
  if (!actions?.length) return null
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {actions.map(({ link, id }, index) => {
        if (!link) return null
        return (
          <CMSButton key={id || `action-${index}`} link={link} variant={link.variant ?? "default"}>
            {link.label || "Action"}
          </CMSButton>
        )
      })}
    </div>
  )
}
