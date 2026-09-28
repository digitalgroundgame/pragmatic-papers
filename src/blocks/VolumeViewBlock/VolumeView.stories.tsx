import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { mocked } from "storybook/test"

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

export const AllVolumes: Story = {
  args: { populateBy: "collection", limit: 4, pageNumber: 1 },
}

export const SecondPage: Story = {
  args: { populateBy: "collection", limit: 4, pageNumber: 2 },
}

export const Selected: Story = {
  args: {
    populateBy: "selection",
    selectedDocs: volumes.slice(0, 2).map((value) => ({ relationTo: "volumes", value })),
  },
}
