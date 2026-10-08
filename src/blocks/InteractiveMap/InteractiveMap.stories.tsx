import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, userEvent, within } from "storybook/test"

import type { MapAsset } from "@/payload-types"
import { FeedHTML } from "@/stories/FeedHTML"
import { interactiveMapBlock, mapAsset } from "@/stories/fixtures/blocks"
import { storyFeedContext } from "@/stories/fixtures/feedContext"

import { interactiveMapToHTML } from "./converters"
import { InteractiveMapBlock } from "./InteractiveMapBlock"

// The seed's district maps, served from the static dir in .storybook/main.ts: an
// `.svg` import resolves to Next's image object, not the markup.
async function loadSvgs(): Promise<{ svgs: Record<number, string> }> {
  const load = (congress: number) =>
    fetch(`/seed-fixtures/mo-districts-${congress}.svg`).then((res) => res.text())
  const [svg119, svg120] = await Promise.all([load(119), load(120)])
  return { svgs: { 119: svg119, 120: svg120 } }
}

const asset = mapAsset

const meta = {
  title: "Blocks/InteractiveMap",
  component: InteractiveMapBlock,
  args: interactiveMapBlock,
  loaders: [loadSvgs],
  render: (args, { loaded }) => (
    <InteractiveMapBlock
      {...args}
      maps={args.maps.map((map) => {
        const svgAsset = map.svgAsset as MapAsset
        return { ...map, svgAsset: { ...svgAsset, svgContent: loaded.svgs[svgAsset.id] } }
      })}
    />
  ),
  argTypes: {
    layout: { control: "inline-radio", options: ["row", "stacked"] },
    colorScale: { control: "inline-radio", options: ["divergingRedBlue", "perRegion"] },
    colorBias: { control: { type: "range", min: -20, max: 20, step: 1 } },
  },
} satisfies Meta<typeof InteractiveMapBlock>

export default meta
type Story = StoryObj<typeof meta>

export const SingleMap: Story = {
  play: async ({ canvasElement }) => {
    // The map loads lazily, so it arrives a moment after the story mounts.
    const region = await within(canvasElement).findByLabelText(/^MO District 1:/)
    await userEvent.hover(region)
    await expect(await screen.findByRole("tooltip")).toHaveTextContent("MO District 1")
  },
}

export const SideBySide: Story = {
  args: {
    widgetTitle: "Before and after redistricting",
    maps: [
      { title: "119th Congress", svgAsset: asset(119), dataAttribute: "data-margin" },
      { title: "120th Congress", svgAsset: asset(120), dataAttribute: "data-margin" },
    ],
  },
}

export const Stacked: Story = {
  args: { ...SideBySide.args, layout: "stacked" },
}

export const WithOverrides: Story = {
  args: {
    maps: [
      {
        title: "119th Congress",
        svgAsset: asset(119),
        dataAttribute: "data-margin",
        overrides: [
          { regionId: "MO-01", label: "St. Louis", color: "#6d28d9" },
          { regionId: "MO-05", label: "Kansas City" },
        ],
      },
    ],
  },
}

export const Biased: Story = {
  args: { colorBias: 8 },
}

/** The map in the feeds: a link back to the page, since no feed reader runs the map. */
export const Feed: Story = {
  render: (args) => <FeedHTML html={interactiveMapToHTML(args, storyFeedContext())} />,
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: /View the interactive map/ })
    await expect(link).toHaveAttribute("href", storyFeedContext().pageUrl)
  },
}
