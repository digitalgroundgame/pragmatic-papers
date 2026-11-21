import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import {
  AllColorTokens,
  BrandInUse,
  Breakpoints,
  Controls,
  FontFamilies,
  HeadingScale,
  PageAudit,
  PageColumns,
  PrimitiveComponents,
  Radii,
  SiteComponents,
  SiteWideFindings,
  SpacingTable,
  TextScale,
  Widths,
} from "./DesignGuide"
import { PAGE_LAYOUTS, SITE_WIDE_FINDINGS } from "./pageLayouts"
import { PRIMITIVES, SITE_COMPONENTS } from "./components"
import { COLOR_GROUPS, RADII, SPACING, WIDTHS } from "./tokens"

/**
 * The pieces the design guide's pages draw, one story each, so each is tested (a play
 * function and the axe check) like any component. The guide itself is the MDX beside this file.
 */
const meta = {
  title: "Design guide/Specimens",
  tags: ["!autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Colors: Story = {
  render: () => <AllColorTokens />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const group of COLOR_GROUPS) {
      const table = canvas.getByRole("table", { name: `${group.title} colors` })
      expect(within(table).getAllByRole("row")).toHaveLength(group.tokens.length + 1)
    }
    // The swatch shows the value globals.css sets, #ff401a.
    const brand = canvasElement.querySelector<HTMLElement>('[data-swatch="brand light"]')
    expect(brand).toHaveStyle({ backgroundColor: "oklch(0.6567 0.2311 32.7)" })
  },
}

export const Brand: Story = {
  render: () => <BrandInUse />,
  play: async ({ canvasElement }) => {
    const light = canvasElement.querySelector<HTMLElement>('[data-theme-panel="light"]')!
    const dark = canvasElement.querySelector<HTMLElement>('[data-theme-panel="dark"]')!
    // Each panel wears its own theme, whatever the page's.
    expect(getComputedStyle(light).backgroundColor).not.toBe(getComputedStyle(dark).backgroundColor)
    expect(within(light).getByText("Philosophy")).toBeInTheDocument()
  },
}

export const Fonts: Story = {
  render: () => <FontFamilies />,
  play: async ({ canvasElement }) => {
    const samples = within(canvasElement).getAllByText("The Pragmatic Papers")
    const families = samples.map((sample) => getComputedStyle(sample).fontFamily)
    expect(new Set(families).size).toBe(3)
  },
}

export const Headings: Story = {
  render: () => <HeadingScale />,
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getAllByText("The Trolley Problem Revisited")).toHaveLength(6)
  },
}

export const Text: Story = {
  render: () => <TextScale />,
}

export const Corners: Story = {
  render: () => <Radii />,
  play: async ({ canvasElement }) => {
    for (const radius of RADII) {
      expect(within(canvasElement).getByText(radius.utility)).toBeInTheDocument()
    }
  },
}

export const ContentWidths: Story = {
  render: () => <Widths />,
  play: async ({ canvasElement }) => {
    for (const width of WIDTHS) {
      expect(within(canvasElement).getByText(width.utility)).toBeInTheDocument()
    }
  },
}

export const BreakpointTable: Story = {
  render: () => <Breakpoints />,
}

export const EverydayControls: Story = {
  render: () => <Controls />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole("button", { name: "Donate" })).toBeInTheDocument()
    expect(canvas.getByRole("textbox", { name: "Email address" })).toBeInTheDocument()
  },
}

export const Columns: Story = {
  render: () => <PageColumns />,
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list", {
      name: "Page content columns at 1280px",
    })
    expect(within(list).getAllByRole("listitem")).toHaveLength(PAGE_LAYOUTS.length)
    expect(list.querySelectorAll("[data-matches]").length).toBeGreaterThan(0)
  },
}

export const Audit: Story = {
  render: () => (
    <div className="space-y-8">
      <SiteWideFindings />
      <PageAudit />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const table = canvas.getByRole("table", { name: "Page audit" })
    expect(within(table).getAllByRole("row")).toHaveLength(PAGE_LAYOUTS.length + 1)
    const findings = canvas.getByRole("list", { name: "Site-wide findings" })
    expect(within(findings).getAllByRole("listitem")).toHaveLength(SITE_WIDE_FINDINGS.length)
  },
}

export const Spacing: Story = {
  render: () => <SpacingTable />,
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole("table", { name: "Spacing" })
    expect(within(table).getAllByRole("row")).toHaveLength(SPACING.length + 1)
  },
}

export const WhichComponent: Story = {
  render: () => (
    <div className="space-y-8">
      <PrimitiveComponents />
      <SiteComponents />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole("link", { name: "LinkButton" })).toHaveAttribute(
      "href",
      "/?path=/docs/ui-linkbutton--docs",
    )
    const links = canvas.getAllByRole("link")
    const expected = [...PRIMITIVES, ...SITE_COMPONENTS].flatMap((use) => use.components)
    expect(links).toHaveLength(expected.length)
  },
}
