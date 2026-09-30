import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/utilities/utils"

const dotVariants = cva("inline-block shrink-0", {
  variants: {
    size: {
      sm: "size-2",
      md: "size-2.5",
    },
    shape: {
      round: "rounded-full",
      square: "rounded-sm",
    },
    tone: {
      brand: "bg-brand",
      primary: "bg-primary",
      muted: "bg-muted-foreground",
      /** No fill: for a ring-only dot, or a colour set with `style`. */
      none: "",
    },
    /** A ring in the page background, so the dot stands off whatever it sits on. */
    ring: {
      true: "ring-background ring-2",
      false: "",
    },
  },
  defaultVariants: {
    size: "sm",
    shape: "round",
    tone: "brand",
    ring: false,
  },
})

/**
 * A small dot: a marker, a legend swatch or a carousel position. Decorative by
 * default (`aria-hidden`); render it as something interactive with `render`,
 * e.g. `render={<button aria-label="…" />}`, and give that its own label.
 */
function Dot({
  className,
  size = "sm",
  shape = "round",
  tone = "brand",
  ring = false,
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof dotVariants>): React.ReactNode {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        "aria-hidden": render ? undefined : true,
        className: cn(dotVariants({ size, shape, tone, ring }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "dot",
      size,
      shape,
      tone,
    },
  })
}

export { Dot, dotVariants }
