import { cn } from "@/utilities/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">): React.ReactNode {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
