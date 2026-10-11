import { TextSearch } from "lucide-react"
import React from "react"

import { Button } from "@/components/ui/button"

/** Opens the mobile menu: its sheet's trigger, and the placeholder until the sheet loads. */
export function MenuButton(props: React.ComponentProps<typeof Button>): React.JSX.Element {
  return (
    <Button variant="ghost" size="icon" data-tour="search" {...props}>
      <TextSearch className="size-6" />
      <span className="sr-only">Menu</span>
    </Button>
  )
}
