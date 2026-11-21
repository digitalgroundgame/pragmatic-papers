import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/utilities/utils"
import globalsCss from "@/app/(frontend)/globals.css?raw"

import { PRIMITIVES, SITE_COMPONENTS, storyDocsId, type ComponentUse } from "./components"
import { parseThemes } from "./cssTokens"
import { COMMON_PATTERN, PAGE_LAYOUTS, SITE_WIDE_FINDINGS, type PageLayout } from "./pageLayouts"
import {
  BREAKPOINTS,
  COLOR_GROUPS,
  FONT_FAMILIES,
  HEADING_SCALE,
  RADII,
  SPACING,
  TEXT_SCALE,
  WIDTHS,
  type ColorGroup,
  type TypeStep,
} from "./tokens"

/**
 * The pieces the design guide's pages (`*.mdx` beside this file) draw: swatches, specimens
 * and the page audit. They read the token values from globals.css itself, so a swatch shows
 * what the site renders.
 */

const THEMES = parseThemes(globalsCss)

const cell = "align-top whitespace-normal"

function Swatch({ value, label }: { value: string | undefined; label: string }): React.ReactNode {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        data-swatch={label}
        className="inline-block size-8 shrink-0 rounded-sm border"
        style={{ background: value }}
      />
      <code className="text-muted-foreground text-xs break-all">{value ?? "unset"}</code>
    </div>
  )
}

export function ColorTokens({ group }: { group: ColorGroup }): React.ReactNode {
  return (
    <Table aria-label={`${group.title} colors`}>
      <TableHeader>
        <TableRow>
          <TableHead>Token</TableHead>
          <TableHead>Light</TableHead>
          <TableHead>Dark</TableHead>
          <TableHead>Use</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {group.tokens.map((token) => (
          <TableRow key={token.name} data-token={token.name}>
            <TableCell className={cell}>
              <code className="font-semibold">--{token.name}</code>
              <div className="text-muted-foreground text-xs">{token.utility}</div>
            </TableCell>
            <TableCell className={cn(cell, "w-48")}>
              <Swatch value={THEMES.light[token.name]} label={`${token.name} light`} />
            </TableCell>
            <TableCell className={cn(cell, "w-48")}>
              <Swatch value={THEMES.dark[token.name]} label={`${token.name} dark`} />
            </TableCell>
            <TableCell className={cn(cell, "text-sm")}>{token.use}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function AllColorTokens(): React.ReactNode {
  return (
    <div className="space-y-10">
      {COLOR_GROUPS.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2>{group.title}</h2>
          <p className="text-muted-foreground max-w-2xl text-sm">{group.description}</p>
          <ColorTokens group={group} />
        </section>
      ))}
    </div>
  )
}

/** A theme's custom properties as inline styles, so a panel shows that theme whatever the page's. */
function themeStyle(theme: "light" | "dark"): React.CSSProperties {
  return Object.fromEntries(
    Object.entries(THEMES[theme]).map(([name, value]) => [`--${name}`, value]),
  ) as React.CSSProperties
}

/** The brand trio in use: what each token is for, side by side in both themes. */
export function BrandInUse(): React.ReactNode {
  const panel = (theme: "light" | "dark") => (
    <div
      data-theme-panel={theme}
      style={themeStyle(theme)}
      className={cn(
        "bg-background text-foreground space-y-4 rounded-sm border p-6",
        theme === "dark" && "dark",
      )}
    >
      <p className="text-brand-text font-serif text-xs font-semibold tracking-widest uppercase">
        Featured
      </p>
      <p className="font-display text-3xl leading-none font-bold tracking-wide">
        Volume <span className="text-brand-text">XII</span>
      </p>
      <div className="flex items-center gap-3">
        <span className="bg-brand-fill inline-flex h-8 items-center rounded-sm px-2.5 text-sm font-medium text-white">
          Donate
        </span>
        <Badge variant="brand">Philosophy</Badge>
        <span aria-hidden className="bg-brand inline-block size-4" />
      </div>
      <blockquote className="border-brand border-l-4 pl-4 font-serif">
        A blockquote&rsquo;s rule is the brand color itself.
      </blockquote>
    </div>
  )
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="brand-in-use">
      {panel("light")}
      {panel("dark")}
    </div>
  )
}

export function FontFamilies(): React.ReactNode {
  return (
    <div className="space-y-6">
      {FONT_FAMILIES.map((font) => (
        <section key={font.name} className="space-y-1 border-b pb-6 last:border-0">
          <p
            className={cn("text-4xl leading-tight", font.utility, {
              "font-bold tracking-wide": font.utility === "font-display",
            })}
          >
            The Pragmatic Papers
          </p>
          <p className="text-sm">
            <strong>{font.name}</strong> · <code>{font.utility}</code>
          </p>
          <p className="text-muted-foreground max-w-2xl text-sm">{font.use}</p>
        </section>
      ))}
    </div>
  )
}

/**
 * Plain sizes for a step's sample: prose classes only size text inside `.prose`, so the
 * rich-text steps are drawn with the Tailwind sizes they compute to.
 */
function sampleClasses(step: TypeStep): string {
  const bySize: Record<string, string> = {
    "60 / 72px": "text-6xl lg:text-7xl",
    "48 / 56px": "text-5xl md:text-[3.5rem]",
    "36 / 48px": "text-4xl md:text-5xl",
    "32 / 36px": "text-3xl md:text-4xl",
    "24 / 32px": "text-2xl md:text-3xl",
    "18 / 20px, leading-relaxed": "text-lg md:text-xl leading-relaxed",
    "18 / 20px": "text-lg md:text-xl text-muted-foreground font-sans",
    "14px": "text-sm font-sans",
    "12px": "text-xs text-muted-foreground font-sans",
  }
  return bySize[step.size] ?? ""
}

function Scale({ steps, display }: { steps: TypeStep[]; display: boolean }): React.ReactNode {
  return (
    <div className="space-y-6">
      {steps.map((step) => (
        <div
          key={step.label}
          className="grid gap-2 border-b pb-6 last:border-0 md:grid-cols-[14rem_1fr]"
        >
          <div className="text-sm">
            <div className="font-semibold">{step.label}</div>
            <div className="text-muted-foreground">{step.size}</div>
            <code className="text-muted-foreground text-xs">{step.classes}</code>
            <div className="text-muted-foreground text-xs">{step.where}</div>
          </div>
          <p
            className={cn(
              display
                ? "font-display leading-none font-bold tracking-wide text-balance"
                : "font-serif",
              sampleClasses(step),
            )}
          >
            {display
              ? "The Trolley Problem Revisited"
              : "Pragmatic Papers publishes community-driven articles on news, politics and economics."}
          </p>
        </div>
      ))}
    </div>
  )
}

export function HeadingScale(): React.ReactNode {
  return <Scale steps={HEADING_SCALE} display />
}

export function TextScale(): React.ReactNode {
  return <Scale steps={TEXT_SCALE} display={false} />
}

export function Radii(): React.ReactNode {
  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
      {RADII.map((radius) => (
        <div key={radius.utility} className="space-y-2 text-sm">
          <div aria-hidden className={cn("bg-muted h-20 border", radius.utility)} />
          <div>
            <code className="font-semibold">{radius.utility}</code> · {radius.value}
          </div>
          <p className="text-muted-foreground text-xs">{radius.use}</p>
        </div>
      ))}
    </div>
  )
}

export function Breakpoints(): React.ReactNode {
  return (
    <Table aria-label="Breakpoints">
      <TableHeader>
        <TableRow>
          <TableHead>Prefix</TableHead>
          <TableHead>From</TableHead>
          <TableHead>What changes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {BREAKPOINTS.map((bp) => (
          <TableRow key={bp.name}>
            <TableCell className={cell}>
              <code>{bp.name}</code>
            </TableCell>
            <TableCell className={cell}>{bp.minWidth}</TableCell>
            <TableCell className={cn(cell, "text-sm")}>{bp.changes}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** Each content width as a bar, to scale against the 80rem container. */
export function Widths(): React.ReactNode {
  return (
    <div className="space-y-4">
      {WIDTHS.map((width) => (
        <div key={width.utility} className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <code className="font-semibold">{width.utility}</code>
            <span className="text-muted-foreground">
              {width.rem}rem ({width.rem * 16}px)
            </span>
          </div>
          <div className="bg-muted h-3 rounded-sm">
            <div
              aria-hidden
              className="bg-foreground/70 mx-auto h-3 rounded-sm"
              style={{ width: `${(width.rem / 80) * 100}%` }}
            />
          </div>
          <p className="text-muted-foreground text-xs">{width.use}</p>
        </div>
      ))}
    </div>
  )
}

const VIEWPORT = 1280
const COMMON = PAGE_LAYOUTS.find((page) => page.wrapper === COMMON_PATTERN)?.desktop

/**
 * Where each page's content column sits in a 1280px window. A dashed outline marks the
 * common column; a page whose column differs is drawn in the brand color.
 */
export function PageColumns(): React.ReactNode {
  const pct = (px: number) => `${(px / VIEWPORT) * 100}%`
  return (
    <ul className="space-y-3" aria-label="Page content columns at 1280px">
      {PAGE_LAYOUTS.map((page) => {
        const matches =
          COMMON && page.desktop.left === COMMON.left && page.desktop.width === COMMON.width
        return (
          <li key={page.route} className="space-y-1" data-matches={matches ? "" : undefined}>
            <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-semibold">{page.name}</span>
              <code className="text-muted-foreground text-xs">{page.route}</code>
              <span className="text-muted-foreground text-xs">
                {page.desktop.left}–{page.desktop.left + page.desktop.width}px
              </span>
            </div>
            <div className="bg-muted relative h-4 rounded-sm">
              {COMMON && (
                <div
                  aria-hidden
                  className="border-foreground/40 absolute inset-y-0 rounded-sm border border-dashed"
                  style={{ left: pct(COMMON.left), width: pct(COMMON.width) }}
                />
              )}
              <div
                aria-hidden
                className={cn(
                  "absolute inset-y-1 rounded-sm",
                  matches ? "bg-foreground/70" : "bg-brand",
                )}
                style={{ left: pct(page.desktop.left), width: pct(page.desktop.width) }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function DeviationList({ page }: { page: PageLayout }): React.ReactNode {
  if (page.deviations.length === 0) {
    return <span className="text-muted-foreground">Follows the common pattern.</span>
  }
  return (
    <ul className="list-disc space-y-1 pl-4">
      {page.deviations.map((deviation) => (
        <li key={deviation}>{deviation}</li>
      ))}
    </ul>
  )
}

export function PageAudit(): React.ReactNode {
  return (
    <Table aria-label="Page audit">
      <TableHeader>
        <TableRow>
          <TableHead>Page</TableHead>
          <TableHead>Column</TableHead>
          <TableHead>Breadcrumbs</TableHead>
          <TableHead>h1</TableHead>
          <TableHead>Above footer</TableHead>
          <TableHead>Where it differs</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {PAGE_LAYOUTS.map((page) => (
          <TableRow key={page.route} data-route={page.route}>
            <TableCell className={cn(cell, "min-w-40")}>
              <div className="font-semibold">{page.name}</div>
              <code className="text-muted-foreground text-xs">{page.route}</code>
            </TableCell>
            <TableCell className={cell}>
              <code className="text-xs">{page.wrapper}</code>
            </TableCell>
            <TableCell className={cell}>{page.breadcrumbs}</TableCell>
            <TableCell className={cell}>{page.h1}</TableCell>
            <TableCell className={cell}>{page.bottomGap}px</TableCell>
            <TableCell className={cn(cell, "min-w-72 text-sm")}>
              <DeviationList page={page} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

const BUTTON_VARIANTS = ["default", "outline", "secondary", "ghost", "link", "branded"] as const
const BADGE_VARIANTS = ["default", "brand", "secondary", "outline"] as const

/** The everyday controls, as the site renders them. */
export function Controls(): React.ReactNode {
  return (
    <div className="mb-8 space-y-4 rounded-sm border p-6" data-testid="controls">
      <div className="flex flex-wrap items-center gap-2">
        {BUTTON_VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant === "branded" ? "Donate" : variant[0]?.toUpperCase() + variant.slice(1)}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {BADGE_VARIANTS.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant === "brand" ? "Philosophy" : variant}
          </Badge>
        ))}
      </div>
      <Separator />
      <form className="flex max-w-md gap-2" onSubmit={(event) => event.preventDefault()}>
        <Input aria-label="Email address" placeholder="you@example.com" type="email" />
        <Button type="submit">Sign up</Button>
      </form>
    </div>
  )
}

export function SiteWideFindings(): React.ReactNode {
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm" aria-label="Site-wide findings">
      {SITE_WIDE_FINDINGS.map((finding) => (
        <li key={finding}>{finding}</li>
      ))}
    </ul>
  )
}

export function SpacingTable(): React.ReactNode {
  return (
    <Table aria-label="Spacing">
      <TableHeader>
        <TableRow>
          <TableHead>Where</TableHead>
          <TableHead>Classes</TableHead>
          <TableHead>Size</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {SPACING.map((use) => (
          <TableRow key={use.where}>
            <TableCell className={cell}>{use.where}</TableCell>
            <TableCell className={cell}>
              <code className="text-xs">{use.classes}</code>
            </TableCell>
            <TableCell className={cell}>{use.size}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ComponentTable({ uses, label }: { uses: ComponentUse[]; label: string }): React.ReactNode {
  const withNotes = uses.some((use) => use.notes)
  return (
    <Table aria-label={label}>
      <TableHeader>
        <TableRow>
          <TableHead>Need</TableHead>
          <TableHead>Component</TableHead>
          {withNotes && <TableHead>Notes</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {uses.map((use) => (
          <TableRow key={use.need}>
            <TableCell className={cell}>{use.need}</TableCell>
            <TableCell className={cell}>
              {use.components.map((component, index) => (
                <span key={component.title}>
                  {index > 0 && ", "}
                  {/* The guide renders inside Storybook's preview frame: open the page in the
                      manager around it. */}
                  <a
                    href={`/?path=/docs/${storyDocsId(component.title)}`}
                    target="_top"
                    className="underline underline-offset-4"
                  >
                    {component.name}
                  </a>
                </span>
              ))}
            </TableCell>
            {withNotes && <TableCell className={cn(cell, "text-sm")}>{use.notes}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function PrimitiveComponents(): React.ReactNode {
  return <ComponentTable uses={PRIMITIVES} label="Primitives" />
}

export function SiteComponents(): React.ReactNode {
  return <ComponentTable uses={SITE_COMPONENTS} label="Site components" />
}
