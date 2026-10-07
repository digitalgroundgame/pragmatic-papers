import { Moon, Sun } from "lucide-react"
import React from "react"

import { Fresh, FRESH } from "@/components/Fresh"
import { Button } from "@/components/ui/button"
import { cn } from "@/utilities/utils"

interface ModeToggleButtonProps extends React.ComponentProps<typeof Button> {
  /** A full-width labeled button instead of the compact icon-only one. */
  showLabel?: boolean
  /** Show the mode toggle's fresh dot. */
  showFresh?: boolean
}

/**
 * The mode toggle's button: the menu's trigger in `ModeToggle`, and on its own the placeholder
 * `LazyModeToggle` renders until the menu loads, so the two look the same.
 */
export function ModeToggleButton({
  showLabel = false,
  showFresh = false,
  className,
  ...props
}: ModeToggleButtonProps): React.JSX.Element {
  return (
    <Button
      variant={showLabel ? "outline" : "ghost"}
      size={showLabel ? "lg" : "icon-sm"}
      className={cn("relative", showLabel && "w-full", className)}
      data-tour="mode-toggle"
      {...props}
    >
      {/* The moon stacks on the sun inside this box, not over the label. */}
      <span className="relative inline-flex size-5 shrink-0">
        <Sun className="size-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute inset-0 size-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </span>
      <span className={showLabel ? undefined : "sr-only"}>Toggle theme</span>
      {showFresh && <Fresh name={FRESH.modeToggle} />}
    </Button>
  )
}
