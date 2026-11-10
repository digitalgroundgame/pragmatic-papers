import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, screen, spyOn, userEvent, waitFor, within } from "storybook/test"

import type { MapAsset } from "@/payload-types"
import { FeedHTML } from "@/stories/FeedHTML"
import { interactiveMapBlock, mapAsset } from "@/stories/fixtures/blocks"
import { storyFeedContext } from "@/stories/fixtures/feedContext"
import { mediaFixture } from "@/stories/fixtures/media"

import { interactiveMapToHTML, interactiveMapToImage } from "./converters"
import { logoMarkup } from "./download/downloadMapImage"
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

/** Saves the map with the download button, and returns the picture and its file name. */
async function download(canvasElement: HTMLElement): Promise<{ name: string; image: ImageBitmap }> {
  const save = spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
  try {
    const button = await within(canvasElement).findByRole("button", {
      name: "Download map as an image",
    })
    await userEvent.click(button)
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    const link = save.mock.contexts[0] as HTMLAnchorElement
    const png = await fetch(link.href).then((res) => res.blob())
    await expect(png.type).toBe("image/png")
    return { name: link.download, image: await createImageBitmap(png) }
  } finally {
    save.mockRestore()
  }
}

/** The picture's top-left pixel, its background. */
function corner(image: ImageBitmap): number[] {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const context = canvas.getContext("2d")!
  context.drawImage(image, 0, 0)
  return [...context.getImageData(0, 0, 1, 1).data]
}

/**
 * The download button under the map saves it as a PNG, at twice Substack's column width, with
 * the title, legend, sources and logo, named for the widget's title, in the theme the page
 * shows. The logo keeps its brand-colored paper.
 */
export const Download: Story = {
  args: { widgetTitle: "Missouri's districts" },
  play: async ({ canvasElement }) => {
    const { name, image } = await download(canvasElement)
    await expect(name).toBe("missouris-districts.png")
    await expect(image.width).toBe(1360)
    await expect(corner(image)).toEqual([255, 255, 255, 255])

    const logo = canvasElement.querySelector("[data-map-logo] svg")
    await expect(logoMarkup(logo, "#171717")).toMatch(/fill="rgb\(25\d, 6\d, 2\d\)"/)
  },
}

/** In dark mode the download is dark too. */
export const DownloadDark: Story = {
  args: Download.args,
  decorators: [
    (Story) => (
      <div className="dark bg-background text-foreground p-4">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const { image } = await download(canvasElement)
    const [r, g, b] = corner(image)
    await expect(Math.max(r!, g!, b!)).toBeLessThan(40)
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

/** The map in the RSS feeds: a link back to the page, since no feed reader runs the map. */
export const Feed: Story = {
  render: (args) => <FeedHTML html={interactiveMapToHTML(args, storyFeedContext())} />,
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: /View the interactive map/ })
    await expect(link).toHaveAttribute("href", storyFeedContext().pageUrl)
  },
}

/**
 * The map in the Substack feed: the picture drawn of it when the article was published,
 * linking to the interactive version. A fixture stands in for the picture, which the server
 * draws.
 */
export const SubstackFeed: Story = {
  render: (args) => (
    <FeedHTML
      html={interactiveMapToImage(
        { ...args, feedImage: mediaFixture({ alt: "Map: Missouri congressional districts" }) },
        storyFeedContext(),
      )}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("img", { name: "Map: Missouri congressional districts" }),
    ).toHaveAttribute("src", expect.stringContaining("/storybook-assets/"))
    await expect(
      canvas.getByRole("link", { name: /View the interactive version/ }),
    ).toHaveAttribute("href", storyFeedContext().pageUrl)
  },
}
