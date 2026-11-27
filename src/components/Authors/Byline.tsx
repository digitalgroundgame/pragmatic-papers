import { cva, type VariantProps } from "class-variance-authority"
import React from "react"

import type { BylineAuthor } from "@/components/Authors/BylineAuthor"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/utilities/getInitials"
import { getSeparator } from "./getSeparator"

const bylineVariants = cva("text-brand-text font-serif font-bold underline-offset-4", {
  variants: {
    size: {
      /** The article page's: 36px faces beside body-size names. */
      default: "",
      /** For lists of results: 24px faces beside small names. */
      sm: "text-sm",
    },
  },
  defaultVariants: { size: "default" },
})

/** The avatar size each byline size draws its faces at. */
const AVATAR_SIZE = { default: "md", sm: "sm" } as const

interface BylineProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof bylineVariants> {
  authors: BylineAuthor[]
}

/**
 * The article byline: a stack of author faces, then every author's name.
 *
 * Every author is shown — the stack is as long as the author list, and the
 * faces overlap left over right so they read as one group. Hovering a face
 * lifts it clear and re-peaks the stack around it: z-index climbs up to the
 * hovered face and falls away after it, so the overlap always points at
 * whichever face you are on. At rest that peak sits on the first face, which
 * is just the plain left-over-right order.
 */
export function Byline({ authors, size, className }: BylineProps): React.ReactNode {
  if (!authors.length) return null

  return (
    <div
      data-slot="byline"
      data-size={size ?? "default"}
      className={bylineVariants({ size, className })}
    >
      <AvatarGroup className="mr-2 inline-flex align-middle">
        {authors.map(({ id, slug, name, avatarUrl }, index) => (
          <Avatar
            key={id}
            size={AVATAR_SIZE[size ?? "default"]}
            // Stack order lives in custom properties so the hover rules can win:
            // an inline z-index would outrank any class.
            //
            // Hovering peaks the stack at the hovered face — `:has(~ *:hover)`
            // is the only way to reach the faces *before* it, and it flips them
            // to ascending so they tuck leftward under it instead of keeping
            // the resting order and stacking the wrong way.
            className="z-(--avatar-z) hover:z-50 [&:has(~*:hover)]:z-(--avatar-z-rev)"
            style={
              {
                "--avatar-z": authors.length - index,
                "--avatar-z-rev": index + 1,
              } as React.CSSProperties
            }
            render={
              <HoverPrefetchLink href={`/contributors/${slug}`} aria-hidden="true" tabIndex={-1} />
            }
          >
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback>{getInitials(name || "A")}</AvatarFallback>
          </Avatar>
        ))}
      </AvatarGroup>
      <span className="align-middle">
        {authors.map(({ id, slug, name }, index) => (
          <React.Fragment key={id}>
            {index > 0 && (
              <span className="text-foreground">{getSeparator(index, authors.length)}</span>
            )}
            <HoverPrefetchLink
              href={`/contributors/${slug}`}
              // underline was exceeding the content size due to the underline-offset-4 set above
              // the addition of pb-1 fixes this issue
              className="pb-1 hover:underline focus-visible:underline"
            >
              {name}
            </HoverPrefetchLink>
          </React.Fragment>
        ))}
      </span>
    </div>
  )
}
