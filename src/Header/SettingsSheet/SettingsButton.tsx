import { User } from "lucide-react"
import React from "react"

import { Fresh, FRESH } from "@/components/Fresh"
import { Button } from "@/components/ui/button"
import { cn } from "@/utilities/utils"

/** Opens the settings sheet: its trigger, and the placeholder until the sheet loads. */
export function SettingsButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>): React.JSX.Element {
  return (
    <Button variant="ghost" size="icon" className={cn("relative lg:hidden", className)} {...props}>
      <User className="size-6" />
      <span className="sr-only">User and Settings</span>
      {/* Below lg the mode toggle lives in this sheet; opening it clears the fresh dot. */}
      <Fresh name={FRESH.modeToggle} />
    </Button>
  )
}
