import { Link2 } from "lucide-react"
import type { ComponentProps } from "react"

import { cn } from "@/utilities/utils"

/** A URL as a reader says it: no scheme, no `www.`, no trailing slash. */
export function shortURL(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
}

/**
 * A link in a post, drawn as an icon. Both the placeholder and the tooltip's trigger render it,
 * so loading the tooltip moves nothing.
 */
export function LinkIcon({
  url,
  className,
  ...props
}: { url: string } & ComponentProps<"a">): React.ReactNode {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Link: ${shortURL(url)}`}
      className={cn(
        "text-muted-foreground hover:text-brand-text flex size-5 items-center justify-center transition-colors",
        className,
      )}
      {...props}
    >
      <Link2 aria-hidden="true" className="size-3.5" />
    </a>
  )
}
