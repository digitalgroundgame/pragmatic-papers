import { cva, type VariantProps } from "class-variance-authority"

interface LegendEntry {
  color: string
  label: string
}

const swatchVariants = cva("rounded-xs", {
  variants: {
    layout: {
      row: "h-5 w-full",
      stacked: "h-4 w-6 shrink-0",
    },
  },
  defaultVariants: { layout: "row" },
})

function LegendSwatch({
  layout,
  color,
}: VariantProps<typeof swatchVariants> & { color: string }): React.ReactNode {
  return (
    <div aria-hidden="true" className={swatchVariants({ layout })} style={{ background: color }} />
  )
}

const labelVariants = cva("", {
  variants: {
    layout: {
      row: "text-xs",
      stacked: "text-xs",
    },
  },
  defaultVariants: { layout: "row" },
})

function LegendLabel({
  layout,
  children,
}: VariantProps<typeof labelVariants> & { children: React.ReactNode }): React.ReactNode {
  return <span className={labelVariants({ layout })}>{children}</span>
}

const itemVariants = cva("flex text-muted-foreground hover:text-foreground font-sans", {
  variants: {
    layout: {
      row: "flex-col items-center gap-0.5",
      stacked: "items-center gap-2",
    },
  },
  defaultVariants: { layout: "row" },
})

function LegendItem({
  layout,
  children,
}: VariantProps<typeof itemVariants> & { children: React.ReactNode }): React.ReactNode {
  return <div className={itemVariants({ layout })}>{children}</div>
}

const legendVariants = cva("", {
  variants: {
    layout: {
      row: "grid grid-cols-[repeat(auto-fit,minmax(2.5rem,1fr))] gap-1",
      stacked: "flex flex-col gap-1",
    },
  },
  defaultVariants: { layout: "row" },
})

interface LegendProps extends VariantProps<typeof legendVariants> {
  legend: LegendEntry[] | null
  className?: string
}

function Legend({ legend, layout, className }: LegendProps): React.ReactNode {
  if (!legend) return null
  return (
    <div className={legendVariants({ layout, className })}>
      {legend.map((entry) => (
        <LegendItem key={entry.label} layout={layout}>
          <LegendSwatch layout={layout} color={entry.color} />
          <LegendLabel layout={layout}>{entry.label}</LegendLabel>
        </LegendItem>
      ))}
    </div>
  )
}

export { Legend, LegendItem, LegendLabel, LegendSwatch, type LegendEntry, type LegendProps }
