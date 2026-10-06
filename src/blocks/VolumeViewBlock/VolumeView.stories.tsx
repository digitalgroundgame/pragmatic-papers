import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, mocked, within } from "storybook/test"

import { knownContrastIssue } from "@/stories/a11y"
import { volumes } from "@/stories/fixtures/docs"
import { createFakePayload } from "@/stories/fixtures/payload"
import { createHeadingNode, createParagraph, richText } from "@/stories/fixtures/richText"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"

import { VolumeViewBlock } from "./component"

const meta = {
  title: "Blocks/VolumeView",
  component: VolumeViewBlock,
  parameters: { layout: "fullscreen", ...knownContrastIssue },
  args: {
    id: "volumes",
    blockType: "volumeView",
    introContent: richText(
      createHeadingNode("Volumes", "h2"),
      createParagraph("Every week's articles, collected."),
    ),
  },
  beforeEach: () => {
    mocked(getPayloadConfig).mockResolvedValue(createFakePayload({ collections: { volumes } }))
  },
} satisfies Meta<typeof VolumeViewBlock>

export default meta
type Story = StoryObj<typeof meta>

/** The volume titles listed, in order; each one links to its volume. */
async function listedVolumes(canvasElement: HTMLElement): Promise<string[]> {
  const canvas = within(canvasElement)
  await canvas.findByRole("heading", { level: 2, name: "Volumes" })
  const headings = canvas.queryAllByRole("heading", { level: 3 })
  for (const heading of headings) {
    await expect(within(heading).getByRole("link")).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/volumes\/\d+$/),
    )
  }
  return headings.map((heading) => heading.textContent ?? "")
}

export const AllVolumes: Story = {
  args: { populateBy: "collection", limit: 4, pageNumber: 1 },
  play: async ({ canvasElement }) => {
    await expect(await listedVolumes(canvasElement)).toEqual([
      "The Local Issue",
      "Courts",
      "Money",
      "Maps",
    ])
    await expect(within(canvasElement).getByText(/Showing 1 - 4 of 6/)).toBeInTheDocument()
  },
}

export const SecondPage: Story = {
  args: { populateBy: "collection", limit: 4, pageNumber: 2 },
  play: async ({ canvasElement }) => {
    await expect(await listedVolumes(canvasElement)).toEqual(["Turnout", "Labor"])
    await expect(within(canvasElement).getByText(/Showing 5 - 6 of 6/)).toBeInTheDocument()
  },
}

export const Selected: Story = {
  args: {
    populateBy: "selection",
    selectedDocs: volumes.slice(0, 2).map((value) => ({ relationTo: "volumes", value })),
  },
  play: async ({ canvasElement }) => {
    await expect(await listedVolumes(canvasElement)).toEqual(["The Local Issue", "Courts"])
    // A hand-picked list is not a page of the collection: no range, no pagination.
    await expect(within(canvasElement).queryByText(/Showing/)).not.toBeInTheDocument()
  },
}
